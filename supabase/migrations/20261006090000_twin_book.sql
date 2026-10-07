-- Phase 6: the Book (build-plan §Phase 6).
--
-- One page per day that actually has words in it, written lazily: opening a day
-- composes a page from what already exists (heuristics, zero LLM calls), and
-- only when someone taps "write it properly" does the twin spend one free-model
-- call to give that day a title and a line of prose.
--
--   book_config  single row: the cover, the dedication, the paper
--   book_pages   one row per day (day is unique — a day has one page)
--   RPCs         days index, day material, upsert (service role), note/favourite
--
-- Privacy (build-plan §7): pages are *derived* from `messages` and are written
-- only by the service role. `messages` is never written to. Both partners can
-- read their own book; notes and favourites go through guarded RPCs; the raw
-- material for composing a page never leaves the database except into the
-- couple's own page.

-- ── 1. Book config (single row) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.book_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title text NOT NULL DEFAULT 'Us',
  subtitle text NOT NULL DEFAULT 'every day we said something worth keeping',
  dedication text NOT NULL DEFAULT '',
  cover_style text NOT NULL DEFAULT 'midnight',   -- midnight|parchment|rose|starlight
  start_day date,                                 -- first day shown; null = first message day
  hide_private boolean NOT NULL DEFAULT true,     -- skip `secret` message types on pages
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.book_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.book_config FROM anon;
DROP POLICY IF EXISTS "partners read book config" ON public.book_config;
CREATE POLICY "partners read book config" ON public.book_config
  FOR SELECT TO authenticated
  USING (public.is_partner(auth.uid()));
DROP POLICY IF EXISTS "owner edits book config" ON public.book_config;
CREATE POLICY "owner edits book config" ON public.book_config
  FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT owner_user_id FROM public.twin_config WHERE id = 1));
GRANT SELECT, UPDATE ON TABLE public.book_config TO authenticated;
GRANT ALL ON TABLE public.book_config TO service_role;

INSERT INTO public.book_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 2. Pages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.book_pages (
  id bigserial PRIMARY KEY,
  day date NOT NULL UNIQUE,
  title text,                                  -- "The umbrella argument"
  subtitle text,                               -- one warm line under the title
  mood text,                                   -- sweet|playful|flirty|hurt|quiet|chaotic|ordinary
  excerpt jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ who, name, text, at, type }]
  photo_url text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,    -- messages, hours, first_at, last_at, top_emoji
  note text NOT NULL DEFAULT '',               -- a handwritten line either of them adds
  favorite boolean NOT NULL DEFAULT false,
  generated_by text NOT NULL DEFAULT 'heuristic',  -- heuristic|llm
  model text,
  tokens int,
  ai_touched boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ready',        -- ready|thin (too little to say)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_pages_day_idx ON public.book_pages (day DESC);
CREATE INDEX IF NOT EXISTS book_pages_fav_idx ON public.book_pages (favorite) WHERE favorite;

ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.book_pages FROM anon;
DROP POLICY IF EXISTS "partners read book pages" ON public.book_pages;
CREATE POLICY "partners read book pages" ON public.book_pages
  FOR SELECT TO authenticated
  USING (public.is_partner(auth.uid()));
GRANT SELECT ON TABLE public.book_pages TO authenticated;
GRANT ALL ON TABLE public.book_pages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.book_pages_id_seq TO service_role;

-- ── 3. The index: which days exist, and which already have a page ────────
-- Cheap enough for the client to call directly: it reads chat_sessions (the
-- Phase 1 index) and left-joins the pages, so a book of 400 days is one query.
CREATE OR REPLACE FUNCTION public.book_days(
  p_limit integer DEFAULT 120,
  p_offset integer DEFAULT 0,
  p_only_pages boolean DEFAULT false,
  p_favorites boolean DEFAULT false
)
RETURNS TABLE (
  day date,
  msg_count integer,
  hours numeric,
  first_at timestamptz,
  last_at timestamptz,
  top_mood text,
  page_id bigint,
  title text,
  mood text,
  favorite boolean,
  has_note boolean,
  ai_touched boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.day,
    d.msg_count,
    d.hours,
    d.first_at,
    d.last_at,
    d.top_mood,
    p.id AS page_id,
    p.title,
    p.mood,
    coalesce(p.favorite, false) AS favorite,
    coalesce(length(btrim(p.note)) > 0, false) AS has_note,
    coalesce(p.ai_touched, false) AS ai_touched
  FROM (
    SELECT
      s.day,
      sum(s.msg_count)::int AS msg_count,
      round((sum(extract(epoch FROM (s.end_at - s.start_at))) / 3600.0)::numeric, 1) AS hours,
      min(s.start_at) AS first_at,
      max(s.end_at) AS last_at,
      (array_agg(s.mood_label ORDER BY s.importance DESC NULLS LAST))[1] AS top_mood
    FROM public.chat_sessions s
    GROUP BY s.day
  ) d
  LEFT JOIN public.book_pages p ON p.day = d.day
  WHERE public.is_partner(auth.uid())
    AND (NOT p_only_pages OR p.id IS NOT NULL)
    AND (NOT p_favorites OR coalesce(p.favorite, false))
    AND d.msg_count > 0
  ORDER BY d.day DESC
  LIMIT greatest(coalesce(p_limit, 120), 1)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;
REVOKE ALL ON FUNCTION public.book_days(integer, integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_days(integer, integer, boolean, boolean) TO authenticated, service_role;

-- ── 4. The material for one day ──────────────────────────────────────────
-- Everything the composer needs, in one round trip: the day's sessions, a
-- curated set of lines (best first), photo messages, and free tone signals.
-- Placeholder rows ("[voice note]" etc.) are skipped here as everywhere else.
CREATE OR REPLACE FUNCTION public.book_day_material(p_day date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  book public.book_config%ROWTYPE;
  owner_ids uuid[];
  result jsonb;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Twin is not configured'; END IF;
  SELECT * INTO book FROM public.book_config WHERE id = 1;

  owner_ids := public.twin_owner_ids();

  WITH day_messages AS (
    SELECT
      m.id,
      m.user_id,
      m.content,
      m.created_at,
      m.message_type,
      m.image_url,
      m.gif_url,
      m.sticker_url,
      m.file_name,
      (m.user_id = ANY (owner_ids)) AS from_owner,
      -- a cheap "how much does this line want to be in a book" score
      (
        least(length(btrim(coalesce(m.content, ''))), 280) * 0.6
        + CASE WHEN coalesce(m.image_url, '') <> '' THEN 40 ELSE 0 END
        + CASE WHEN coalesce(m.content, '') ~ '[?？]' THEN 12 ELSE 0 END
        + CASE WHEN coalesce(m.content, '') ~* '(love|jaan|miss|sorry|maaf|pyaar|dil|thank)' THEN 18 ELSE 0 END
        + CASE WHEN coalesce(m.content, '') ~ '[😀😁😂🤣😊😍🥰😘🥺😢😭❤💕💖]' THEN 6 ELSE 0 END
      )::numeric AS shine
    FROM public.messages m
    WHERE m.created_at >= (p_day::timestamp AT TIME ZONE (SELECT timezone FROM public.twin_config WHERE id = 1))
      AND m.created_at <  ((p_day + 1)::timestamp AT TIME ZONE (SELECT timezone FROM public.twin_config WHERE id = 1))
      AND NOT public.twin_is_ignored_message(m.message_type)
      AND NOT public.twin_is_placeholder_content(m.content)
      AND (NOT coalesce(book.hide_private, true) OR coalesce(m.message_type, 'text') <> 'secret')
  ),
  picked AS (
    SELECT * FROM day_messages ORDER BY shine DESC, created_at ASC LIMIT 7
  )
  SELECT jsonb_build_object(
    'day', p_day,
    'owner_name', cfg.owner_name,
    'partner_name', cfg.partner_name,
    'owner_ids', to_jsonb(owner_ids),
    'stats', jsonb_build_object(
      'messages', (SELECT count(*) FROM day_messages),
      'photos',   (SELECT count(*) FROM day_messages WHERE coalesce(image_url, '') <> ''),
      'first_at', (SELECT min(created_at) FROM day_messages),
      'last_at',  (SELECT max(created_at) FROM day_messages),
      'sessions', (SELECT count(*) FROM public.chat_sessions s WHERE s.day = p_day),
      'hours', (
        SELECT coalesce(round((sum(extract(epoch FROM (s.end_at - s.start_at))) / 3600.0)::numeric, 1), 0)
        FROM public.chat_sessions s WHERE s.day = p_day
      ),
      'tone', (
        SELECT coalesce((array_agg(t ORDER BY n DESC))[1], 'other')
        FROM (
          SELECT public.twin_tone(m.content) AS t, count(*) AS n
          FROM day_messages m GROUP BY 1
        ) x
      )
    ),
    'lines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'who', CASE WHEN p.from_owner THEN 'owner' ELSE 'partner' END,
        'name', CASE WHEN p.from_owner THEN cfg.owner_name ELSE cfg.partner_name END,
        'text', left(btrim(p.content), 400),
        'at', p.created_at,
        'type', coalesce(p.message_type, 'text'),
        'url', coalesce(nullif(p.image_url, ''), nullif(p.gif_url, ''), nullif(p.sticker_url, ''))
      ) ORDER BY p.created_at)
      FROM picked p
    ), '[]'::jsonb),
    'photos', coalesce((
      SELECT jsonb_agg(u ORDER BY u) FROM (
        SELECT DISTINCT coalesce(nullif(image_url, ''), nullif(sticker_url, '')) AS u
        FROM day_messages
        WHERE coalesce(nullif(image_url, ''), nullif(sticker_url, '')) IS NOT NULL
        LIMIT 6
      ) ph
    ), '[]'::jsonb),
    'page', (
      SELECT to_jsonb(p) FROM public.book_pages p WHERE p.day = p_day
    )
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.book_day_material(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_day_material(date) TO service_role;

-- ── 5. Upsert (service role only — the edge function writes pages) ───────
CREATE OR REPLACE FUNCTION public.book_page_upsert(
  p_day date,
  p_title text,
  p_subtitle text,
  p_mood text,
  p_excerpt jsonb,
  p_photo_url text,
  p_stats jsonb,
  p_generated_by text,
  p_model text DEFAULT NULL,
  p_tokens int DEFAULT NULL,
  p_ai_touched boolean DEFAULT false,
  p_status text DEFAULT 'ready',
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.book_pages%ROWTYPE;
  saved public.book_pages%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM public.book_pages WHERE day = p_day;

  -- Never downgrade a page that a person (or the twin, on request) wrote:
  -- a heuristic pass only fills gaps unless the caller forces it.
  IF FOUND AND NOT p_force THEN
    UPDATE public.book_pages SET
      title    = coalesce(nullif(title, ''), nullif(p_title, '')),
      subtitle = coalesce(nullif(subtitle, ''), nullif(p_subtitle, '')),
      mood     = coalesce(nullif(mood, ''), nullif(p_mood, '')),
      excerpt  = CASE WHEN jsonb_array_length(coalesce(excerpt, '[]'::jsonb)) >= jsonb_array_length(coalesce(p_excerpt, '[]'::jsonb))
                      THEN excerpt ELSE coalesce(p_excerpt, excerpt) END,
      photo_url = coalesce(photo_url, p_photo_url),
      stats    = coalesce(p_stats, stats),
      status   = CASE WHEN status = 'thin' THEN coalesce(p_status, status) ELSE status END,
      updated_at = now()
    WHERE day = p_day
    RETURNING * INTO saved;
  ELSE
    INSERT INTO public.book_pages AS b
      (day, title, subtitle, mood, excerpt, photo_url, stats, generated_by, model, tokens, ai_touched, status)
    VALUES
      (p_day, p_title, p_subtitle, p_mood, coalesce(p_excerpt, '[]'::jsonb), p_photo_url,
       coalesce(p_stats, '{}'::jsonb), coalesce(p_generated_by, 'heuristic'), p_model, p_tokens,
       coalesce(p_ai_touched, false), coalesce(p_status, 'ready'))
    ON CONFLICT (day) DO UPDATE SET
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      mood = EXCLUDED.mood,
      excerpt = EXCLUDED.excerpt,
      photo_url = EXCLUDED.photo_url,
      stats = EXCLUDED.stats,
      generated_by = EXCLUDED.generated_by,
      model = EXCLUDED.model,
      tokens = EXCLUDED.tokens,
      ai_touched = EXCLUDED.ai_touched,
      status = EXCLUDED.status,
      updated_at = now()
    RETURNING * INTO saved;
  END IF;

  RETURN to_jsonb(saved);
END;
$$;
REVOKE ALL ON FUNCTION public.book_page_upsert(date, text, text, text, jsonb, text, jsonb, text, text, int, boolean, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_page_upsert(date, text, text, text, jsonb, text, jsonb, text, text, int, boolean, text, boolean) TO service_role;

-- ── 6. Notes & favourites (either of them, guarded RPCs) ─────────────────
CREATE OR REPLACE FUNCTION public.book_page_note(p_day date, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.book_pages%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  UPDATE public.book_pages
     SET note = left(coalesce(p_note, ''), 600), updated_at = now()
   WHERE day = p_day
  RETURNING * INTO saved;

  IF NOT FOUND THEN RAISE EXCEPTION 'That day has no page yet'; END IF;
  RETURN jsonb_build_object('day', saved.day, 'note', saved.note);
END;
$$;
REVOKE ALL ON FUNCTION public.book_page_note(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_page_note(date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.book_page_favorite(p_day date, p_favorite boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.book_pages%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  UPDATE public.book_pages
     SET favorite = coalesce(p_favorite, false), updated_at = now()
   WHERE day = p_day
  RETURNING * INTO saved;

  IF NOT FOUND THEN RAISE EXCEPTION 'That day has no page yet'; END IF;
  RETURN jsonb_build_object('day', saved.day, 'favorite', saved.favorite);
END;
$$;
REVOKE ALL ON FUNCTION public.book_page_favorite(date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_page_favorite(date, boolean) TO authenticated, service_role;

-- ── 7. Cover: update config (owner) + a small stats readout ──────────────
CREATE OR REPLACE FUNCTION public.book_set_config(
  p_title text DEFAULT NULL,
  p_subtitle text DEFAULT NULL,
  p_dedication text DEFAULT NULL,
  p_cover_style text DEFAULT NULL,
  p_hide_private boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.book_config%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> (SELECT owner_user_id FROM public.twin_config WHERE id = 1) THEN
    RAISE EXCEPTION 'Only the owner can edit the cover';
  END IF;

  UPDATE public.book_config SET
    title = coalesce(nullif(btrim(p_title), ''), title),
    subtitle = coalesce(nullif(btrim(p_subtitle), ''), subtitle),
    dedication = coalesce(p_dedication, dedication),
    cover_style = coalesce(nullif(btrim(p_cover_style), ''), cover_style),
    hide_private = coalesce(p_hide_private, hide_private),
    updated_at = now()
  WHERE id = 1
  RETURNING * INTO saved;

  RETURN to_jsonb(saved);
END;
$$;
REVOKE ALL ON FUNCTION public.book_set_config(text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_set_config(text, text, text, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.book_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'days_total',   (SELECT count(*) FROM (SELECT 1 FROM public.chat_sessions GROUP BY day) d),
    'days_written', (SELECT count(*) FROM public.book_pages),
    'favorites',    (SELECT count(*) FROM public.book_pages WHERE favorite),
    'llm_written',  (SELECT count(*) FROM public.book_pages WHERE ai_touched),
    'tokens_used',  (SELECT coalesce(sum(tokens), 0) FROM public.book_pages),
    'first_day',    (SELECT min(day) FROM public.chat_sessions),
    'last_day',     (SELECT max(day) FROM public.chat_sessions),
    'messages',     (SELECT coalesce(sum(msg_count), 0) FROM public.chat_sessions)
  )
  WHERE public.is_partner(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.book_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_stats() TO authenticated, service_role;
