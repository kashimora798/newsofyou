-- Phase 1 tuning — written after the first real `twin_inspect()` run.
--
-- Observed (2025-11-21 → 2026-10-02, 55,653 rows):
--   text 52,673 | gif 1,651 | voice_note 513 | image 354 | touch_reaction 200
--   sticker 109 | secret 78 | video 44 | letter 24 | bored 3 | coinflip 2 | rps 1 | file 1
--   blank content 2,954 (2,942 media-only) | isReact rows 197 | 4 distinct user_ids
--
-- What changes:
--   1. `twin_is_ignored_message` now ignores only MECHANICAL rows. Letters,
--      secret messages and media captions are real text and stay in the corpus
--      (the old list wrongly threw away `letter`, `secret` and captions).
--   2. New placeholder filter for captions like "[Voice note]".
--   3. All rebuild functions re-created with both filters.
--   4. `twin_config` learns optional extra account ids per side (people change
--      accounts; the observed history has 4 user_ids).
--   5. Setup helpers: `twin_set_config(...)` and `twin_user_report()`.
--
-- Idempotent: safe to re-run, nothing is dropped, `messages` is untouched.

-- ── 1. Mechanical message types only ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.twin_is_ignored_message(p_message_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(lower(p_message_type), 'text') IN (
    'touch_reaction',   -- taps / hugs: UI gestures, 200 rows
    'reaction', 'react',
    'coinflip', 'rps', 'bored',   -- game outcome rows, 6 rows
    'system'
  );
$$;

-- Captions that carry no words (media placeholders).
CREATE OR REPLACE FUNCTION public.twin_is_placeholder_content(p_content text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(btrim(p_content), '') = ''
      OR btrim(p_content) ~* '^\[(voice note|voice|sticker|gif|image|photo|video|file|document|media|deleted)\]$'
      OR btrim(p_content) ~ '^[\s\p{So}\p{Sk}]+$';   -- emoji/punctuation only
$$;

-- ── 2. Rebuild functions with the corrected filters ──────────────────────

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
      DELETE FROM public.chat_sessions WHERE start_at = cut;
    END IF;
  END IF;

  WITH m AS (
    SELECT id, username, content, created_at,
           lag(created_at) OVER (ORDER BY created_at, id) AS prev_at
    FROM public.messages
    WHERE content IS NOT NULL
      AND NOT public.twin_is_placeholder_content(content)
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
           string_agg(coalesce(username, 'Someone') || ': ' || content, E'\n' ORDER BY created_at, id) AS transcript
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
           coalesce(m.username, 'Someone') || ': ' || m.content AS line,
           ((m.rn - 1) / 16) AS chunk_no
    FROM public.chat_sessions s
    JOIN LATERAL (
      SELECT row_number() OVER (ORDER BY x.created_at, x.id) AS rn,
             x.username, x.content
      FROM public.messages x
      WHERE x.content IS NOT NULL
        AND NOT public.twin_is_placeholder_content(x.content)
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
  owner_ids uuid[];
  partner_ids uuid[];
  cut_date date;
  inserted integer := 0;
BEGIN
  owner_ids := public.twin_owner_ids();
  partner_ids := public.twin_partner_ids();
  IF owner_ids IS NULL OR partner_ids IS NULL THEN
    RAISE NOTICE 'twin_config is empty — run select public.twin_set_config(...) first.';
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
      AND NOT public.twin_is_placeholder_content(content)
      AND length(btrim(content)) >= 2
      AND coalesce("isReact", false) = false
      AND NOT public.twin_is_ignored_message(message_type)
      AND (p_full OR created_at >= ((cut_date::timestamp) AT TIME ZONE p_tz))
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
    SELECT user_id, min(created_at) AS start_at, max(created_at) AS end_at,
           string_agg(content, ' ' ORDER BY created_at, id) AS text
    FROM numbered
    GROUP BY user_id, burst_no
  ), pairs AS (
    SELECT b1.start_at AS partner_start,
           (b1.start_at AT TIME ZONE p_tz)::date AS day,
           b1.text AS partner_text,
           b2.text AS owner_reply
    FROM bursts b1
    JOIN LATERAL (
      SELECT b2.*
      FROM bursts b2
      WHERE b2.user_id = ANY (owner_ids)
        AND b2.start_at >= b1.end_at
        AND b2.start_at - b1.end_at <= interval '15 minutes'
      ORDER BY b2.start_at
      LIMIT 1
    ) b2 ON true
    WHERE b1.user_id = ANY (partner_ids)
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
  WHERE length(btrim(p.partner_text)) >= 2
    AND length(btrim(p.owner_reply)) >= 2;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- ── 3. Extra accounts per side ───────────────────────────────────────────
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS owner_user_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS partner_user_ids uuid[] NOT NULL DEFAULT '{}';

-- Effective id lists: the array when set, otherwise the single id column.
CREATE OR REPLACE FUNCTION public.twin_owner_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.owner_user_ids IS NULL OR c.owner_user_ids = '{}'::uuid[] THEN ARRAY[c.owner_user_id]
    ELSE (SELECT array_agg(DISTINCT x) FROM unnest(c.owner_user_ids || ARRAY[c.owner_user_id]) AS x)
  END
  FROM public.twin_config c WHERE c.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.twin_partner_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.partner_user_ids IS NULL OR c.partner_user_ids = '{}'::uuid[] THEN ARRAY[c.partner_user_id]
    ELSE (SELECT array_agg(DISTINCT x) FROM unnest(c.partner_user_ids || ARRAY[c.partner_user_id]) AS x)
  END
  FROM public.twin_config c WHERE c.id = 1;
$$;

REVOKE ALL ON FUNCTION public.twin_owner_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.twin_partner_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_owner_ids() TO service_role;
GRANT EXECUTE ON FUNCTION public.twin_partner_ids() TO service_role;

-- ── 4. Setup helpers ─────────────────────────────────────────────────────

-- One-call config. Never touches consent: twin_enabled / partner_consented_at
-- are preserved on update.
CREATE OR REPLACE FUNCTION public.twin_set_config(
  p_owner uuid,
  p_partner uuid,
  p_owner_name text,
  p_partner_name text,
  p_partner_nicknames text[] DEFAULT '{}',
  p_owner_nicknames text[] DEFAULT '{}',
  p_owner_extra_ids uuid[] DEFAULT '{}',
  p_partner_extra_ids uuid[] DEFAULT '{}',
  p_tz text DEFAULT 'Asia/Kolkata'
)
RETURNS public.twin_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.twin_config%ROWTYPE;
BEGIN
  INSERT INTO public.twin_config AS c (
    id, owner_user_id, partner_user_id, owner_name, partner_name,
    partner_nicknames, owner_nicknames, owner_user_ids, partner_user_ids, timezone
  ) VALUES (
    1, p_owner, p_partner, p_owner_name, p_partner_name,
    coalesce(p_partner_nicknames, '{}'), coalesce(p_owner_nicknames, '{}'),
    coalesce(p_owner_extra_ids, '{}'), coalesce(p_partner_extra_ids, '{}'), coalesce(p_tz, 'Asia/Kolkata')
  )
  ON CONFLICT (id) DO UPDATE SET
    owner_user_id = EXCLUDED.owner_user_id,
    partner_user_id = EXCLUDED.partner_user_id,
    owner_name = EXCLUDED.owner_name,
    partner_name = EXCLUDED.partner_name,
    partner_nicknames = EXCLUDED.partner_nicknames,
    owner_nicknames = EXCLUDED.owner_nicknames,
    owner_user_ids = EXCLUDED.owner_user_ids,
    partner_user_ids = EXCLUDED.partner_user_ids,
    timezone = EXCLUDED.timezone
  RETURNING * INTO row_out;
  RETURN row_out;
END;
$$;

REVOKE ALL ON FUNCTION public.twin_set_config(uuid, uuid, text, text, text[], text[], uuid[], uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_set_config(uuid, uuid, text, text, text[], text[], uuid[], uuid[], text) TO service_role;

-- Who is who? Run this to identify the four accounts before configuring.
CREATE OR REPLACE FUNCTION public.twin_user_report()
RETURNS TABLE (
  user_id uuid,
  total bigint,
  first_at timestamptz,
  last_at timestamptz,
  months jsonb,
  names text[],
  recent_messages text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id,
         count(*) AS total,
         min(m.created_at) AS first_at,
         max(m.created_at) AS last_at,
         (SELECT jsonb_object_agg(t.mon, t.c ORDER BY t.mon)
            FROM (SELECT to_char(date_trunc('month', z.created_at), 'YYYY-MM') AS mon, count(*) AS c
                    FROM public.messages z WHERE z.user_id = m.user_id GROUP BY 1) t) AS months,
         (SELECT array_agg(DISTINCT x.username) FROM public.messages x
           WHERE x.user_id = m.user_id AND x.username IS NOT NULL) AS names,
         (SELECT array_agg(r.sample) FROM (
            SELECT left(y.content, 90) AS sample
              FROM public.messages y
             WHERE y.user_id = m.user_id
               AND y.content IS NOT NULL
               AND NOT public.twin_is_placeholder_content(y.content)
             ORDER BY y.created_at DESC
             LIMIT 3
          ) r) AS recent_messages
  FROM public.messages m
  GROUP BY m.user_id
  ORDER BY total DESC;
$$;

REVOKE ALL ON FUNCTION public.twin_user_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_user_report() TO authenticated, service_role;
