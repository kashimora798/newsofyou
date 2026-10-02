-- Phase 1: turn `messages` into a searchable memory (build-plan §Phase 1).
--
-- `messages` is READ-ONLY here: nothing in this file inserts, updates or
-- deletes a row. Everything below is derived data that can be rebuilt at any
-- time from `messages` alone (that is the point — if the index breaks, drop the
-- derived rows and re-run the rebuild functions).
--
-- Contents
--   1. extensions                vector + pg_trgm
--   2. twin_config               who is who, consent state, single row
--   3. chat_sessions             bursts of conversation (3h gap)
--   4. chat_chunks               ~20-message windows (-4 overlap) + embedding
--   5. reply_pairs               her burst -> his burst (<= 15 min) + embedding
--   6. tone classifier           free heuristic, no LLM (build-plan §5)
--   7. rebuild functions         full + incremental, service-role only
--   8. search functions          match_reply_pairs / match_chunks (RRF)
--   9. twin_style_card           the editable voice profile
--  10. inspection helper         read-only report of the messages table
--
-- RLS: derived tables are service-role only (RLS on, NO policies). twin_config
-- and twin_style_card get policies because partners read them and the owner edits.

-- ── 1. Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 2. twin_config — one row, who is who ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twin_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  owner_user_id uuid NOT NULL,          -- the twin speaks as this person
  partner_user_id uuid NOT NULL,        -- the twin talks with this person
  owner_name text NOT NULL,
  partner_name text NOT NULL,
  partner_nicknames text[] NOT NULL DEFAULT '{}',
  owner_nicknames text[] NOT NULL DEFAULT '{}',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  twin_enabled boolean NOT NULL DEFAULT false,
  partner_consented_at timestamptz,     -- set when SHE agrees in the UI (Phase 4)
  embed_dim int NOT NULL DEFAULT 384
);

ALTER TABLE public.twin_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partners read config" ON public.twin_config;
CREATE POLICY "partners read config" ON public.twin_config
  FOR SELECT TO authenticated
  USING (public.is_partner(auth.uid()));
DROP POLICY IF EXISTS "owner updates config" ON public.twin_config;
CREATE POLICY "owner updates config" ON public.twin_config
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id);
REVOKE ALL ON TABLE public.twin_config FROM anon;
GRANT SELECT, UPDATE ON TABLE public.twin_config TO authenticated;
GRANT ALL ON TABLE public.twin_config TO service_role;

-- ── 3. chat_sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id bigserial PRIMARY KEY,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  day date NOT NULL,                    -- local calendar day of the start
  msg_count int NOT NULL,
  first_msg_id uuid,
  last_msg_id uuid,
  transcript text NOT NULL,
  summary text,
  mood_label text,
  mood_score real,
  importance real NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS chat_sessions_day_idx ON public.chat_sessions (day);

-- ── 4. chat_chunks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_chunks (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  day date NOT NULL,
  transcript text NOT NULL,
  embedding vector(384)
);
CREATE INDEX IF NOT EXISTS chat_chunks_session_idx ON public.chat_chunks (session_id);
CREATE INDEX IF NOT EXISTS chat_chunks_day_idx ON public.chat_chunks (day);

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS chat_chunks_emb_idx ON public.chat_chunks USING hnsw (embedding vector_cosine_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'chat_chunks hnsw index skipped (%): %', SQLSTATE, SQLERRM;
END;
$$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS chat_chunks_trgm_idx ON public.chat_chunks USING gin (transcript gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'chat_chunks trgm index skipped (%): %', SQLSTATE, SQLERRM;
END;
$$;

-- ── 5. reply_pairs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reply_pairs (
  id bigserial PRIMARY KEY,
  session_id bigint REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  day date NOT NULL,
  partner_text text NOT NULL,
  owner_reply text NOT NULL,
  tone text,
  embedding vector(384)
);
CREATE INDEX IF NOT EXISTS reply_pairs_session_idx ON public.reply_pairs (session_id);
CREATE INDEX IF NOT EXISTS reply_pairs_day_idx ON public.reply_pairs (day);
CREATE INDEX IF NOT EXISTS reply_pairs_tone_idx ON public.reply_pairs (tone);

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS reply_pairs_emb_idx ON public.reply_pairs USING hnsw (embedding vector_cosine_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reply_pairs hnsw index skipped (%): %', SQLSTATE, SQLERRM;
END;
$$;

-- ── derived tables: RLS on, NO policies (service-role only) ──────────────
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reply_pairs   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_sessions, public.chat_chunks, public.reply_pairs FROM anon, authenticated;
GRANT ALL ON TABLE public.chat_sessions, public.chat_chunks, public.reply_pairs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chat_sessions_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chat_chunks_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.reply_pairs_id_seq TO service_role;

-- ── 6. Free tone classifier (build-plan §5, no LLM) ──────────────────────
CREATE OR REPLACE FUNCTION public.twin_tone(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_text IS NULL OR btrim(p_text) = '' THEN 'other'
    -- sorry / apology (English + Hindi + Hinglish)
    WHEN p_text ~* '(sorry|maaf|maafi|galti|my bad|apolog)' THEN 'sorry'
    -- flirty
    WHEN p_text ~* '(cutie|hot|sexy|kiss|kissi|ummmah|😘|😏|😉|🌶️|flirt|naughty)' THEN 'flirty'
    -- playful
    WHEN p_text ~* '(haha|lol|lmao|hehe|😂|🤣|😜|😝|tease|mazak|mazaak)' THEN 'playful'
    -- sweet / love
    WHEN p_text ~* '(love|jaan|baby|babu|shona|sweetheart|miss you|miss u|❤️|💕|🥰|😍|💖|pyar|pyaar|dil|jaanu|cutu)' THEN 'sweet'
    -- caring
    WHEN p_text ~* '(khana|khaana|eat|soyi|soya|sona|neend|rest|medicine|dawai|take care|drink water|paani|aram|thak|health)' THEN 'caring'
    -- serious: long and/or question-heavy, and no emoji at all
    WHEN (length(btrim(p_text)) > 140 OR (p_text ~ '\?' AND length(btrim(p_text)) > 80))
         AND p_text !~ '[😀😁😂🤣😊😍🥰😘😉😏❤💕💖🔥😜😝🙈🥺😢😭]' THEN 'serious'
    ELSE 'other'
  END;
$$;

-- ── 7. Rebuild functions (service-role only) ─────────────────────────────

-- Message-type / media filter kept in ONE place. `twin_inspect()` below prints
-- the real distinct values from your database — adjust this list if your data
-- uses different labels (this is the "ADJUST" note from the build plan).
CREATE OR REPLACE FUNCTION public.twin_is_ignored_message(p_message_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(lower(p_message_type), 'text') IN (
    'sticker', 'stickers', 'sticker_gif', 'gif', 'image', 'photo', 'picture',
    'video', 'file', 'document', 'voice', 'voice_note', 'audio', 'media',
    'reaction', 'react', 'system'
  );
$$;

-- Sessions: bursts of conversation separated by more than p_gap.
-- p_full = true wipes and rebuilds everything; otherwise only the newest
-- session is reopened and rebuilt (cheap nightly delta, no duplicates).
CREATE OR REPLACE FUNCTION public.rebuild_chat_sessions(
  p_gap interval DEFAULT interval '3 hours',
  p_full boolean DEFAULT false,
  p_tz text DEFAULT 'Asia/Kolkata'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cut timestamptz := 'epoch'::timestamptz;
  inserted integer := 0;
BEGIN
  IF p_full THEN
    TRUNCATE public.chat_sessions RESTART IDENTITY CASCADE;
  ELSE
    SELECT start_at INTO cut FROM public.chat_sessions ORDER BY start_at DESC LIMIT 1;
    IF cut IS NULL THEN
      cut := 'epoch'::timestamptz;
    ELSE
      -- reopen exactly the newest session; older ones cannot change
      DELETE FROM public.chat_sessions WHERE start_at = cut;
    END IF;
  END IF;

  WITH m AS (
    SELECT id, username, content, created_at,
           lag(created_at) OVER (ORDER BY created_at, id) AS prev_at
    FROM public.messages
    WHERE content IS NOT NULL
      AND btrim(content) <> ''
      AND coalesce("isReact", false) = false
      AND NOT public.twin_is_ignored_message(message_type)
      AND created_at >= cut
  ), g AS (
    SELECT *,
           sum(CASE WHEN prev_at IS NULL OR created_at - prev_at > p_gap THEN 1 ELSE 0 END)
             OVER (ORDER BY created_at, id) AS sess_no
    FROM m
  ), s AS (
    SELECT min(created_at) AS start_at,
           max(created_at) AS end_at,
           (min(created_at) AT TIME ZONE p_tz)::date AS day,
           count(*) AS msg_count,
           (array_agg(id ORDER BY created_at, id))[1] AS first_msg_id,
           (array_agg(id ORDER BY created_at DESC, id DESC))[1] AS last_msg_id,
           string_agg(username || ': ' || content, E'\n' ORDER BY created_at, id) AS transcript
    FROM g
    GROUP BY sess_no
  )
  INSERT INTO public.chat_sessions (start_at, end_at, day, msg_count, first_msg_id, last_msg_id, transcript)
  SELECT start_at, end_at, day, msg_count, first_msg_id, last_msg_id, transcript
  FROM s
  ORDER BY start_at;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- Chunks: ~20-message windows stepping 16 (4 overlap). A message is never
-- split — windows are built from whole lines. Only sessions without chunks are
-- processed, so re-running is free.
CREATE OR REPLACE FUNCTION public.rebuild_chat_chunks(p_full boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
BEGIN
  IF p_full THEN
    DELETE FROM public.chat_chunks;
  END IF;

  WITH ranked AS (
    SELECT s.id AS session_id,
           s.day,
           m.rn,
           m.username || ': ' || m.content AS line,
           ((m.rn - 1) / 16) AS chunk_no
    FROM public.chat_sessions s
    JOIN LATERAL (
      SELECT row_number() OVER (ORDER BY x.created_at, x.id) AS rn,
             x.username, x.content
      FROM public.messages x
      WHERE x.content IS NOT NULL
        AND btrim(x.content) <> ''
        AND coalesce(x."isReact", false) = false
        AND NOT public.twin_is_ignored_message(x.message_type)
        AND x.created_at >= s.start_at
        AND x.created_at <= s.end_at
    ) m ON true
    WHERE NOT EXISTS (SELECT 1 FROM public.chat_chunks c WHERE c.session_id = s.id)
  )
  INSERT INTO public.chat_chunks (session_id, day, transcript)
  SELECT session_id, day, string_agg(line, E'\n' ORDER BY rn)
  FROM ranked
  GROUP BY session_id, day, chunk_no;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- Reply pairs: collapse consecutive messages by the same sender within 2
-- minutes into a "burst", then pair a partner burst with the owner burst that
-- answers it within 15 minutes. Tone is heuristic (no LLM).
CREATE OR REPLACE FUNCTION public.rebuild_reply_pairs(
  p_full boolean DEFAULT false,
  p_tz text DEFAULT 'Asia/Kolkata',
  p_keep_days integer DEFAULT 3
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  cut_date date;
  inserted integer := 0;
BEGIN
  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF NOT FOUND THEN
    RAISE NOTICE 'twin_config is empty — insert the single config row first.';
    RETURN 0;
  END IF;

  IF p_full THEN
    DELETE FROM public.reply_pairs;
  ELSE
    cut_date := (now() AT TIME ZONE p_tz)::date - greatest(p_keep_days, 1);
    DELETE FROM public.reply_pairs WHERE day >= cut_date;
  END IF;

  WITH src AS (
    SELECT id, user_id, username, content, created_at
    FROM public.messages
    WHERE content IS NOT NULL
      AND btrim(content) <> ''
      AND length(btrim(content)) >= 2
      AND coalesce("isReact", false) = false
      AND NOT public.twin_is_ignored_message(message_type)
      AND (p_full OR created_at >= (cut_date::timestamp AT TIME ZONE p_tz))
  ), marked AS (
    SELECT src.*,
           lag(created_at) OVER (ORDER BY created_at, id) AS prev_at,
           lag(user_id) OVER (ORDER BY created_at, id) AS prev_user
    FROM src
  ), numbered AS (
    SELECT marked.*,
           sum(CASE
                 WHEN prev_at IS NULL
                   OR created_at - prev_at > interval '2 minutes'
                   OR prev_user IS DISTINCT FROM user_id
                 THEN 1 ELSE 0 END)
             OVER (ORDER BY created_at, id) AS burst_no
    FROM marked
  ), bursts AS (
    SELECT user_id, username, burst_no,
           min(created_at) AS start_at,
           max(created_at) AS end_at,
           string_agg(content, ' ' ORDER BY created_at, id) AS text
    FROM numbered
    GROUP BY user_id, username, burst_no
  ), pairs AS (
    SELECT b1.start_at AS partner_start,
           (b1.start_at AT TIME ZONE p_tz)::date AS day,
           b1.text AS partner_text,
           b2.text AS owner_reply,
           b2.start_at AS owner_start
    FROM bursts b1
    JOIN LATERAL (
      SELECT b2.*
      FROM bursts b2
      WHERE b2.user_id = cfg.owner_user_id
        AND b2.user_id <> b1.user_id
        AND b2.start_at >= b1.end_at
        AND b2.start_at - b1.end_at <= interval '15 minutes'
      ORDER BY b2.start_at
      LIMIT 1
    ) b2 ON true
    WHERE b1.user_id = cfg.partner_user_id
  )
  INSERT INTO public.reply_pairs (session_id, day, partner_text, owner_reply, tone)
  SELECT (SELECT s.id FROM public.chat_sessions s
           WHERE p.partner_start >= s.start_at AND p.partner_start <= s.end_at
           ORDER BY s.start_at DESC LIMIT 1),
         p.day,
         p.partner_text,
         p.owner_reply,
         public.twin_tone(p.partner_text)
  FROM pairs p
  WHERE length(btrim(p.partner_text)) >= 2;   -- skip sticker/GIF-only bursts

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- Nightly entry point: sessions -> chunks -> pairs, then hand off to
-- embed-backfill for the vectors.
CREATE OR REPLACE FUNCTION public.twin_rebuild_all(p_full boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s integer;
  c integer;
  r integer;
BEGIN
  s := public.rebuild_chat_sessions(interval '3 hours', p_full);
  c := public.rebuild_chat_chunks(p_full);
  r := public.rebuild_reply_pairs(p_full);
  RETURN jsonb_build_object('sessions', s, 'chunks', c, 'reply_pairs', r);
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_chat_sessions(interval, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_chat_chunks(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_reply_pairs(boolean, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.twin_rebuild_all(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_chat_sessions(interval, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_chat_chunks(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_reply_pairs(boolean, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.twin_rebuild_all(boolean) TO service_role;

-- ── 8. Search (vector + trigram, merged with reciprocal rank fusion) ──────

CREATE OR REPLACE FUNCTION public.match_reply_pairs(
  q vector(384),
  k int DEFAULT 8,
  want_tone text DEFAULT NULL
)
RETURNS TABLE (id bigint, partner_text text, owner_reply text, tone text, day date, sim real)
LANGUAGE sql
STABLE
AS $$
  SELECT r.id, r.partner_text, r.owner_reply, r.tone, r.day,
         (1 - (r.embedding <=> q))::real AS sim
  FROM public.reply_pairs r
  WHERE r.embedding IS NOT NULL
    AND (want_tone IS NULL OR r.tone = want_tone)
  ORDER BY r.embedding <=> q
  LIMIT greatest(k, 1);
$$;

CREATE OR REPLACE FUNCTION public.match_chunks(
  q vector(384),
  qtext text,
  k int DEFAULT 6
)
RETURNS TABLE (id bigint, day date, transcript text, score real)
LANGUAGE sql
STABLE
AS $$
  WITH v AS (
    SELECT c.id, c.day, c.transcript,
           row_number() OVER (ORDER BY c.embedding <=> q) AS r
    FROM public.chat_chunks c
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> q
    LIMIT 30
  ), t AS (
    SELECT c.id, c.day, c.transcript,
           row_number() OVER (ORDER BY similarity(c.transcript, qtext) DESC) AS r
    FROM public.chat_chunks c
    WHERE c.transcript % qtext
    ORDER BY similarity(c.transcript, qtext) DESC
    LIMIT 30
  )
  SELECT u.id, u.day, u.transcript, sum(1.0 / (60 + u.r))::real AS score
  FROM (SELECT * FROM v UNION ALL SELECT * FROM t) u
  GROUP BY u.id, u.day, u.transcript
  ORDER BY score DESC
  LIMIT greatest(k, 1);
$$;

REVOKE ALL ON FUNCTION public.match_reply_pairs(vector, int, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_chunks(vector, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_reply_pairs(vector, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, text, int) TO service_role;

-- ── 9. Style card (Phase 1E) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twin_style_card (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  card text NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.twin_style_card ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partners read style card" ON public.twin_style_card;
CREATE POLICY "partners read style card" ON public.twin_style_card
  FOR SELECT TO authenticated
  USING (public.is_partner(auth.uid()));
DROP POLICY IF EXISTS "owner writes style card" ON public.twin_style_card;
CREATE POLICY "owner writes style card" ON public.twin_style_card
  FOR ALL TO authenticated
  USING (exists (SELECT 1 FROM public.twin_config c WHERE c.id = 1 AND c.owner_user_id = auth.uid()))
  WITH CHECK (exists (SELECT 1 FROM public.twin_config c WHERE c.id = 1 AND c.owner_user_id = auth.uid()));
REVOKE ALL ON TABLE public.twin_style_card FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.twin_style_card TO authenticated;
GRANT ALL ON TABLE public.twin_style_card TO service_role;

-- ── 10. Inspection helper (read-only) ────────────────────────────────────
-- The build plan's "first task of every session": run this in the SQL editor
-- and paste the result, so the twin filters and heuristics can be tuned to the
-- real data. Nothing here writes to `messages`.
CREATE OR REPLACE FUNCTION public.twin_inspect()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'message_count', (SELECT count(*) FROM public.messages),
    'date_range', (
      SELECT jsonb_build_object('first', min(created_at), 'last', max(created_at))
      FROM public.messages
    ),
    'message_types', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('type', t.message_type, 'n', t.n) ORDER BY t.n DESC), '[]'::jsonb)
      FROM (
        SELECT coalesce(message_type, '(null)') AS message_type, count(*) AS n
        FROM public.messages GROUP BY 1 ORDER BY n DESC
      ) t
    ),
    'per_sender', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('username', s.username, 'user_id', s.user_id, 'n', s.n) ORDER BY s.n DESC), '[]'::jsonb)
      FROM (
        SELECT username, user_id, count(*) AS n
        FROM public.messages GROUP BY 1, 2 ORDER BY n DESC
      ) s
    ),
    'null_or_blank_content', (SELECT count(*) FROM public.messages WHERE content IS NULL OR btrim(content) = ''),
    'react_rows', (SELECT count(*) FROM public.messages WHERE coalesce("isReact", false) = true),
    'media_only_rows', (
      SELECT count(*) FROM public.messages
      WHERE (content IS NULL OR btrim(content) = '')
        AND (image_url IS NOT NULL OR file_url IS NOT NULL OR gif_url IS NOT NULL
             OR sticker_url IS NOT NULL OR video IS TRUE OR "vidUrl" IS NOT NULL)
    ),
    'has_is_memory_column', (
      SELECT count(*) > 0 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'is_memory'
    ),
    'extensions', (
      SELECT jsonb_object_agg(e.extname, e.extversion)
      FROM pg_extension e WHERE e.extname IN ('vector', 'pg_trgm', 'pg_cron', 'pg_net')
    ),
    'sessions', (SELECT count(*) FROM public.chat_sessions),
    'chunks', (SELECT count(*) FROM public.chat_chunks),
    'chunks_without_embedding', (SELECT count(*) FROM public.chat_chunks WHERE embedding IS NULL),
    'reply_pairs', (SELECT count(*) FROM public.reply_pairs),
    'pairs_without_embedding', (SELECT count(*) FROM public.reply_pairs WHERE embedding IS NULL),
    'twin_config_present', (SELECT count(*) > 0 FROM public.twin_config)
  );
$$;

REVOKE ALL ON FUNCTION public.twin_inspect() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_inspect() TO authenticated, service_role;

-- ── seed reminder (manual, one row) ──────────────────────────────────────
-- After applying, insert YOUR row (ids from twin_inspect()):
--
--   insert into public.twin_config
--     (id, owner_user_id, partner_user_id, owner_name, partner_name)
--   values (1, '<your-uuid>', '<her-uuid>', 'Kratagya', 'Ishita')
--   on conflict (id) do nothing;
--
-- Keep twin_enabled = false and partner_consented_at = null until she agrees
-- in the Phase 4 consent screen. The twin refuses to answer without both.
