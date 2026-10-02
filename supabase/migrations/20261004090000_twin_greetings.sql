-- Phase 2: dark "spell" login + AI greeting bank (build-plan §Phase 2).
--
--   twin_greeting_bank   ~300 pre-written greetings (mood × daypart), owner-editable
--   twin_greeting_log    one row per greeting shown (never any AI prompt content)
--   twin_login_attempts  rate-limit ledger for spell-login (IP + name)
--   RPCs                 consent, owner check, greeting pick (atomic LRU), tone, attempts
--
-- RLS: the bank is owner-only (she must not see the surprises), the log and
-- attempt ledger are service-role only (RLS on, no policies). `messages` is
-- never written to.

-- ── 1. Greeting bank ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twin_greeting_bank (
  id bigserial PRIMARY KEY,
  mood text NOT NULL,
  daypart text NOT NULL DEFAULT 'any',      -- morning|afternoon|evening|night|any
  text text NOT NULL,
  source text NOT NULL DEFAULT 'seed',      -- seed|live|manual
  active boolean NOT NULL DEFAULT true,
  uses int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS twin_greeting_bank_pick_idx
  ON public.twin_greeting_bank (mood, daypart, active, uses, last_used_at);
CREATE UNIQUE INDEX IF NOT EXISTS twin_greeting_bank_unique
  ON public.twin_greeting_bank (mood, daypart, lower(text));

ALTER TABLE public.twin_greeting_bank ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twin_greeting_bank FROM anon;
DROP POLICY IF EXISTS "owner manages greeting bank" ON public.twin_greeting_bank;
CREATE POLICY "owner manages greeting bank" ON public.twin_greeting_bank
  FOR ALL TO authenticated
  USING (exists (SELECT 1 FROM public.twin_config c WHERE c.id = 1 AND c.owner_user_id = auth.uid()))
  WITH CHECK (exists (SELECT 1 FROM public.twin_config c WHERE c.id = 1 AND c.owner_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.twin_greeting_bank TO authenticated;
GRANT ALL ON TABLE public.twin_greeting_bank TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.twin_greeting_bank_id_seq TO authenticated, service_role;

-- ── 2. Greeting log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twin_greeting_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  bank_id bigint,
  mood text,
  daypart text,
  source text NOT NULL DEFAULT 'bank',      -- bank|live|static
  shown_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS twin_greeting_log_user_idx
  ON public.twin_greeting_log (user_id, shown_at DESC);

ALTER TABLE public.twin_greeting_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twin_greeting_log FROM anon, authenticated;
GRANT ALL ON TABLE public.twin_greeting_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.twin_greeting_log_id_seq TO service_role;

-- ── 3. Login attempts (spell-login rate limiting) ────────────────────────
CREATE TABLE IF NOT EXISTS public.twin_login_attempts (
  id bigserial PRIMARY KEY,
  name text NOT NULL,                        -- lower-cased name label
  ip text,
  ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS twin_login_attempts_idx
  ON public.twin_login_attempts (name, ip, created_at DESC);

ALTER TABLE public.twin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twin_login_attempts FROM anon, authenticated;
GRANT ALL ON TABLE public.twin_login_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.twin_login_attempts_id_seq TO service_role;

-- ── 4. Config additions ──────────────────────────────────────────────────
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS anniversary_date date DEFAULT '2025-06-19';
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS greeting_live_per_day int NOT NULL DEFAULT 1;

-- The two name labels for the login cards. Called by anonymous visitors, so it
-- deliberately exposes ONLY the display labels (never ids, emails, nicknames or
-- consent state). Documented trade-off: the hidden login page shows two names.
CREATE OR REPLACE FUNCTION public.twin_login_cards()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
       'owner_label', c.owner_name,
       'partner_label', c.partner_name,
       'enabled', c.twin_enabled
     ) FROM public.twin_config c WHERE c.id = 1),
    'null'::jsonb
  );
$$;
REVOKE ALL ON FUNCTION public.twin_login_cards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.twin_login_cards() TO anon, authenticated, service_role;

-- ── 5. Login attempt ledger ──────────────────────────────────────────────
-- allowed = fewer than 5 failures for this name+ip in the last 15 minutes.
-- Also returns a `dim` flag after 3 failures so the UI can fade the stars.
CREATE OR REPLACE FUNCTION public.twin_login_attempt_check(
  p_name text,
  p_ip text DEFAULT NULL,
  p_max integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fails integer;
  oldest timestamptz;
BEGIN
  DELETE FROM public.twin_login_attempts WHERE created_at < now() - interval '7 days';

  SELECT count(*), min(created_at) INTO fails, oldest
  FROM public.twin_login_attempts
  WHERE lower(name) = lower(coalesce(p_name, ''))
    AND (p_ip IS NULL OR ip = p_ip)
    AND ok = false
    AND created_at > now() - make_interval(mins => greatest(p_window_minutes, 1));

  RETURN jsonb_build_object(
    'allowed', fails < greatest(p_max, 1),
    'fails', fails,
    'dim', fails >= 3,
    'retry_after', CASE
      WHEN fails < greatest(p_max, 1) THEN 0
      ELSE GREATEST(0, ceil(extract(epoch FROM (oldest + make_interval(mins => greatest(p_window_minutes, 1)) - now()))))::int
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.twin_login_attempt_record(
  p_name text,
  p_ip text DEFAULT NULL,
  p_ok boolean DEFAULT false
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.twin_login_attempts (name, ip, ok) VALUES (lower(coalesce(p_name, '')), p_ip, coalesce(p_ok, false));
$$;

REVOKE ALL ON FUNCTION public.twin_login_attempt_check(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.twin_login_attempt_record(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_login_attempt_check(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.twin_login_attempt_record(text, text, boolean) TO service_role;

-- ── 6. Greeting picker (atomic: choose, mark used, log) ──────────────────
CREATE OR REPLACE FUNCTION public.twin_greeting_pick(
  p_user uuid,
  p_mood text,
  p_daypart text,
  p_avoid text[] DEFAULT '{}'
)
RETURNS TABLE (id bigint, text text, mood text, daypart text, source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen public.twin_greeting_bank%ROWTYPE;
BEGIN
  -- 1. exact mood + daypart  2. mood + any  3. any mood + daypart  4. any
  SELECT b.* INTO chosen FROM public.twin_greeting_bank b
   WHERE b.active AND b.mood = p_mood AND b.daypart = p_daypart
     AND NOT (lower(b.text) = ANY (SELECT lower(x) FROM unnest(coalesce(p_avoid, '{}')) AS x))
   ORDER BY b.uses ASC, b.last_used_at ASC NULLS FIRST, random()
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT b.* INTO chosen FROM public.twin_greeting_bank b
     WHERE b.active AND b.mood = p_mood
     ORDER BY b.uses ASC, b.last_used_at ASC NULLS FIRST, random()
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    SELECT b.* INTO chosen FROM public.twin_greeting_bank b
     WHERE b.active AND b.daypart = p_daypart
     ORDER BY b.uses ASC, b.last_used_at ASC NULLS FIRST, random()
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    SELECT b.* INTO chosen FROM public.twin_greeting_bank b
     WHERE b.active
     ORDER BY b.uses ASC, b.last_used_at ASC NULLS FIRST, random()
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN;   -- empty bank: caller falls back to its static line
  END IF;

  UPDATE public.twin_greeting_bank
     SET uses = uses + 1, last_used_at = now()
   WHERE public.twin_greeting_bank.id = chosen.id;

  INSERT INTO public.twin_greeting_log (user_id, bank_id, mood, daypart, source)
  VALUES (p_user, chosen.id, chosen.mood, chosen.daypart, chosen.source);

  RETURN QUERY SELECT chosen.id, chosen.text, chosen.mood, chosen.daypart, chosen.source;
END;
$$;

REVOKE ALL ON FUNCTION public.twin_greeting_pick(uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_greeting_pick(uuid, text, text, text[]) TO service_role;

-- Context for the picker: what was shown recently, and whether today already
-- had a live (LLM-written) greeting.
CREATE OR REPLACE FUNCTION public.twin_greeting_context(p_user uuid, p_tz text DEFAULT 'Asia/Kolkata')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'last_shown_at', (SELECT max(shown_at) FROM public.twin_greeting_log WHERE user_id = p_user),
    'last_mood', (SELECT mood FROM public.twin_greeting_log WHERE user_id = p_user ORDER BY shown_at DESC LIMIT 1),
    'last_texts', coalesce((
      SELECT jsonb_agg(t.text) FROM (
        SELECT text FROM public.twin_greeting_log l
        JOIN public.twin_greeting_bank b ON b.id = l.bank_id
        WHERE l.user_id = p_user ORDER BY l.shown_at DESC LIMIT 5
      ) t), '[]'::jsonb),
    'shown_24h', (SELECT count(*) FROM public.twin_greeting_log
                   WHERE user_id = p_user AND shown_at > now() - interval '24 hours'),
    'live_today', (SELECT count(*) FROM public.twin_greeting_log
                    WHERE user_id = p_user AND source = 'live'
                      AND (shown_at AT TIME ZONE p_tz)::date = (now() AT TIME ZONE p_tz)::date),
    'shown_total', (SELECT count(*) FROM public.twin_greeting_log WHERE user_id = p_user)
  );
$$;

REVOKE ALL ON FUNCTION public.twin_greeting_context(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_greeting_context(uuid, text) TO service_role;

-- Dominant tone of one person's messages in a window (free heuristic).
CREATE OR REPLACE FUNCTION public.twin_recent_tone(
  p_user uuid,
  p_hours integer DEFAULT 24
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT t.tone FROM (
      SELECT public.twin_tone(content) AS tone, count(*) AS n
      FROM public.messages
      WHERE user_id = p_user
        AND content IS NOT NULL
        AND NOT public.twin_is_placeholder_content(content)
        AND created_at > now() - make_interval(hours => greatest(p_hours, 1))
      GROUP BY 1
      ORDER BY n DESC
      LIMIT 1
    ) t
  ), 'other');
$$;

REVOKE ALL ON FUNCTION public.twin_recent_tone(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_recent_tone(uuid, integer) TO service_role;

-- ── 7. Consent + ownership (build-plan §7.1) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.twin_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.twin_config c WHERE c.id = 1 AND c.owner_user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.twin_is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_is_owner() TO authenticated, service_role;

-- Only SHE can consent, and only for herself.
CREATE OR REPLACE FUNCTION public.twin_record_consent()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Twin is not configured'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF auth.uid() <> cfg.partner_user_id AND NOT (auth.uid() = ANY (coalesce(cfg.partner_user_ids, '{}'))) THEN
    RAISE EXCEPTION 'Only her account can give consent';
  END IF;

  UPDATE public.twin_config
     SET partner_consented_at = now(), twin_enabled = true
   WHERE id = 1;

  RETURN jsonb_build_object('consented_at', now(), 'enabled', true);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_record_consent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_record_consent() TO authenticated, service_role;

-- Either of them can switch the twin off. She can also purge.
-- p_purge removes what was derived ABOUT her (memories about her, twin chats);
-- the shared chat index (chunks/pairs) is only touched when p_purge_index.
CREATE OR REPLACE FUNCTION public.twin_revoke_consent(
  p_purge boolean DEFAULT true,
  p_purge_index boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  mem integer := 0;
  conv integer := 0;
  idx integer := 0;
BEGIN
  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Twin is not configured'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  IF auth.uid() <> cfg.owner_user_id
     AND auth.uid() <> cfg.partner_user_id
     AND NOT (auth.uid() = ANY (coalesce(cfg.partner_user_ids, '{}'))) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  UPDATE public.twin_config
     SET twin_enabled = false, partner_consented_at = NULL
   WHERE id = 1;

  IF p_purge THEN
    -- ai_memories arrives with Phase 5 — purge it only once it exists.
    IF to_regclass('public.ai_memories') IS NOT NULL THEN
      DELETE FROM public.ai_memories
       WHERE subject_user_id = cfg.partner_user_id
          OR subject_user_id = ANY (coalesce(cfg.partner_user_ids, '{}'));
      GET DIAGNOSTICS mem = ROW_COUNT;
    END IF;

    IF to_regclass('public.twin_messages') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.twin_messages m USING public.twin_conversations c
                WHERE m.conversation_id = c.id AND c.user_id = $1'
        USING cfg.partner_user_id;
      EXECUTE 'DELETE FROM public.twin_conversations WHERE user_id = $1' USING cfg.partner_user_id;
      GET DIAGNOSTICS conv = ROW_COUNT;
    END IF;
  END IF;

  IF p_purge_index THEN
    UPDATE public.chat_chunks SET embedding = NULL;
    UPDATE public.reply_pairs SET embedding = NULL;
    GET DIAGNOSTICS idx = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('enabled', false, 'memories_deleted', mem, 'conversations_deleted', conv, 'vectors_cleared', idx);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_revoke_consent(boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_revoke_consent(boolean, boolean) TO authenticated, service_role;

-- Owner on/off switch (does not fabricate consent).
CREATE OR REPLACE FUNCTION public.twin_set_enabled(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Twin is not configured'; END IF;
  IF auth.uid() <> cfg.owner_user_id THEN RAISE EXCEPTION 'Only the owner can change this'; END IF;

  UPDATE public.twin_config SET twin_enabled = coalesce(p_enabled, false) WHERE id = 1;
  RETURN jsonb_build_object(
    'enabled', coalesce(p_enabled, false),
    'consented', cfg.partner_consented_at IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.twin_set_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_set_enabled(boolean) TO authenticated, service_role;

-- Admin screen data: bank size per mood/daypart + usage.
CREATE OR REPLACE FUNCTION public.twin_greeting_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.twin_greeting_bank),
    'active', (SELECT count(*) FROM public.twin_greeting_bank WHERE active),
    'used', (SELECT count(*) FROM public.twin_greeting_bank WHERE uses > 0),
    'by_bucket', coalesce((
      SELECT jsonb_agg(x ORDER BY x.mood, x.daypart) FROM (
        SELECT mood, daypart, count(*) AS n, sum(uses) AS uses
        FROM public.twin_greeting_bank GROUP BY 1, 2
      ) x), '[]'::jsonb),
    'shown_total', (SELECT count(*) FROM public.twin_greeting_log),
    'shown_7d', (SELECT count(*) FROM public.twin_greeting_log WHERE shown_at > now() - interval '7 days'),
    'live_7d', (SELECT count(*) FROM public.twin_greeting_log WHERE source = 'live' AND shown_at > now() - interval '7 days')
  );
$$;
REVOKE ALL ON FUNCTION public.twin_greeting_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_greeting_stats() TO authenticated, service_role;
