-- Phase 8 — Face to Face.
-- ============================================================================
-- A room for the conversation that is too heavy for the normal chat.
--
-- The shape:
--   * one of them opens a room with a topic;
--   * both read the same six ground rules and both must agree before a single
--     word is exchanged (`agreed_by` holds the user ids who agreed);
--   * turns alternate. Before sending, either of them may ask for a gentler
--     version of what they wrote — the AI rewrites it, they choose, and only
--     what they choose is stored (`ftf_turns.content`, with `original` kept
--     beside it when softening was used, so nobody can be misquoted);
--   * if a turn carries a self-harm or abuse signal, the room **stops**: no
--     more mediation, status 'stopped', and the app shows real resources.
--     The flag is recorded on the turn, so this is auditable.
--   * either of them can pause ("take a break" is a ground rule) or close.
--
-- Idempotent; nothing dropped; `messages` untouched.

-- ── 1. Sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ftf_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by   uuid NOT NULL,
  partner_id   uuid,                                   -- filled when the other side joins
  topic        text NOT NULL DEFAULT 'something we need to talk about',
  status       text NOT NULL DEFAULT 'waiting',        -- waiting|active|paused|closed|stopped
  stage        text NOT NULL DEFAULT 'rules',          -- rules|turns|closing|done
  agreed_by    uuid[] NOT NULL DEFAULT '{}',
  turn_user_id uuid,                                   -- whose turn it is
  turn_count   int NOT NULL DEFAULT 0,
  max_turns    int NOT NULL DEFAULT 24,
  stop_flags   text[] NOT NULL DEFAULT '{}',
  stop_at      timestamptz,
  close_note   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ftf_sessions_open
  ON public.ftf_sessions (updated_at DESC)
  WHERE status IN ('waiting', 'active', 'paused', 'stopped');
CREATE INDEX IF NOT EXISTS idx_ftf_sessions_recent ON public.ftf_sessions (created_at DESC);

ALTER TABLE public.ftf_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners read ftf sessions" ON public.ftf_sessions;
CREATE POLICY "partners read ftf sessions" ON public.ftf_sessions
  FOR SELECT TO authenticated
  USING (public.is_partner(auth.uid()) AND (started_by = auth.uid() OR partner_id = auth.uid() OR partner_id IS NULL));

REVOKE ALL ON TABLE public.ftf_sessions FROM anon;
GRANT SELECT ON TABLE public.ftf_sessions TO authenticated;
GRANT ALL ON TABLE public.ftf_sessions TO service_role;

-- ── 2. Turns ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ftf_turns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ftf_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  kind       text NOT NULL DEFAULT 'message',          -- message|summary|resources|system
  content    text NOT NULL,                            -- what the other person reads
  original   text,                                     -- what they typed, if softened
  softened   boolean NOT NULL DEFAULT false,
  flags      text[] NOT NULL DEFAULT '{}',             -- safety flags on this turn
  model      text,
  tokens     int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ftf_turns_session ON public.ftf_turns (session_id, created_at ASC);

ALTER TABLE public.ftf_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners read ftf turns" ON public.ftf_turns;
CREATE POLICY "partners read ftf turns" ON public.ftf_turns
  FOR SELECT TO authenticated
  USING (
    public.is_partner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ftf_sessions s
      WHERE s.id = session_id
        AND (s.started_by = auth.uid() OR s.partner_id = auth.uid() OR s.partner_id IS NULL)
    )
  );

REVOKE ALL ON TABLE public.ftf_turns FROM anon;
GRANT SELECT ON TABLE public.ftf_turns TO authenticated;
GRANT ALL ON TABLE public.ftf_turns TO service_role;

-- ── 3. Open a room ──────────────────────────────────────────────────────
-- Only one open room at a time: opening a new one closes the old, quietly.
CREATE OR REPLACE FUNCTION public.ftf_open(p_topic text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  other uuid;
  opened public.ftf_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF FOUND THEN
    other := CASE WHEN cfg.owner_user_id = auth.uid() THEN cfg.partner_user_id ELSE cfg.owner_user_id END;
  END IF;

  UPDATE public.ftf_sessions
     SET status = 'closed', stage = 'done', closed_at = now(), updated_at = now(),
         close_note = coalesce(close_note, 'Faded away — a new room was opened.')
   WHERE status IN ('waiting', 'active', 'paused')
     AND (started_by = auth.uid() OR partner_id = auth.uid());

  INSERT INTO public.ftf_sessions (started_by, partner_id, topic, status, stage)
  VALUES (
    auth.uid(), other,
    left(coalesce(nullif(btrim(p_topic), ''), 'something we need to talk about'), 200),
    'waiting', 'rules'
  )
  RETURNING * INTO opened;

  RETURN to_jsonb(opened);
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_open(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_open(text) TO authenticated, service_role;

-- ── 4. Join / agree / pause / close ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ftf_join(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.ftf_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  UPDATE public.ftf_sessions
     SET partner_id = coalesce(partner_id, auth.uid()), updated_at = now()
   WHERE id = p_session
     AND (partner_id IS NULL AND started_by <> auth.uid())
  RETURNING * INTO s;

  IF NOT FOUND THEN
    SELECT * INTO s FROM public.ftf_sessions WHERE id = p_session;
  END IF;

  RETURN to_jsonb(s);
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_join(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_join(uuid) TO authenticated, service_role;

-- Both must agree the ground rules before the first turn is allowed.
CREATE OR REPLACE FUNCTION public.ftf_agree(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.ftf_sessions%ROWTYPE;
  both_agreed boolean;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  SELECT * INTO s FROM public.ftf_sessions WHERE id = p_session;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such room';
  IF auth.uid() <> s.started_by AND auth.uid() <> coalesce(s.partner_id, s.started_by) THEN
    RAISE EXCEPTION 'That room is not yours';
  END IF;

  UPDATE public.ftf_sessions
     SET agreed_by = (
           SELECT array_agg(DISTINCT u) FROM unnest(array_append(s.agreed_by, auth.uid())) AS u
         ),
         -- the person who opened the room speaks first
         turn_user_id = coalesce(turn_user_id, s.started_by),
         updated_at = now()
   WHERE id = p_session
  RETURNING * INTO s;

  both_agreed := s.partner_id IS NOT NULL
             AND array_length(s.agreed_by, 1) >= 2
             AND s.started_by = ANY(s.agreed_by)
             AND s.partner_id = ANY(s.agreed_by);

  IF both_agreed AND s.stage = 'rules' THEN
    UPDATE public.ftf_sessions SET stage = 'turns', status = 'active', updated_at = now()
     WHERE id = p_session RETURNING * INTO s;
  END IF;

  RETURN to_jsonb(s) || jsonb_build_object('both_agreed', both_agreed);
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_agree(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_agree(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ftf_pause(p_session uuid, p_paused boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.ftf_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  UPDATE public.ftf_sessions
     SET status = CASE WHEN coalesce(p_paused, true) THEN 'paused' ELSE 'active' END,
         updated_at = now()
   WHERE id = p_session
     AND status IN ('active', 'paused')
     AND (started_by = auth.uid() OR partner_id = auth.uid())
  RETURNING * INTO s;

  IF NOT FOUND THEN
    SELECT * INTO s FROM public.ftf_sessions WHERE id = p_session;
  END IF;

  RETURN to_jsonb(s);
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_pause(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_pause(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ftf_close(p_session uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.ftf_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  UPDATE public.ftf_sessions
     SET status = CASE WHEN status = 'stopped' THEN 'stopped' ELSE 'closed' END,
         stage = 'done',
         close_note = coalesce(left(p_note, 2000), close_note),
         closed_at = now(),
         updated_at = now()
   WHERE id = p_session
     AND (started_by = auth.uid() OR partner_id = auth.uid())
  RETURNING * INTO s;

  IF NOT FOUND THEN
    SELECT * INTO s FROM public.ftf_sessions WHERE id = p_session;
  END IF;

  RETURN to_jsonb(s);
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_close(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_close(uuid, text) TO authenticated, service_role;

-- ── 5. A turn ───────────────────────────────────────────────────────────
-- Validates whose turn it is, flips it, and — the important line — stops the
-- whole room the moment a safety flag arrives.
CREATE OR REPLACE FUNCTION public.ftf_add_turn(
  p_session uuid,
  p_content text,
  p_original text DEFAULT NULL,
  p_softened boolean DEFAULT false,
  p_flags text[] DEFAULT '{}',
  p_kind text DEFAULT 'message',
  p_model text DEFAULT NULL,
  p_tokens int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.ftf_sessions%ROWTYPE;
  saved public.ftf_turns%ROWTYPE;
  flags text[] := coalesce(p_flags, '{}');
  is_system boolean := coalesce(p_kind, 'message') IN ('summary', 'resources', 'system');
  stops boolean := flags && ARRAY['self_harm', 'abuse']::text[];
BEGIN
  SELECT * INTO s FROM public.ftf_sessions WHERE id = p_session;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such room';
  IF auth.uid() IS NOT NULL AND auth.uid() <> s.started_by AND auth.uid() <> coalesce(s.partner_id, s.started_by) THEN
    RAISE EXCEPTION 'That room is not yours';
  END IF;
  IF s.status = 'closed' THEN RAISE EXCEPTION 'This room is closed'; END IF;

  -- only a system turn may be written while the room is paused or stopped
  IF NOT is_system THEN
    IF s.status = 'stopped' THEN RAISE EXCEPTION 'This room has stopped'; END IF;
    IF s.status = 'paused' THEN RAISE EXCEPTION 'The room is paused'; END IF;
    IF s.stage <> 'turns' THEN RAISE EXCEPTION 'The ground rules are not agreed yet'; END IF;
    IF s.turn_user_id IS NOT NULL AND s.turn_user_id <> auth.uid() THEN RAISE EXCEPTION 'It is not your turn'; END IF;
    IF length(btrim(coalesce(p_content, ''))) < 1 THEN RAISE EXCEPTION 'Nothing to say'; END IF;
  END IF;

  INSERT INTO public.ftf_turns (session_id, user_id, kind, content, original, softened, flags, model, tokens)
  VALUES (
    p_session, coalesce(auth.uid(), s.started_by), coalesce(p_kind, 'message'),
    left(p_content, 6000), left(p_original, 6000), coalesce(p_softened, false), flags, p_model, p_tokens
  )
  RETURNING * INTO saved;

  UPDATE public.ftf_sessions SET
    turn_count = turn_count + CASE WHEN is_system THEN 0 ELSE 1 END,
    turn_user_id = CASE
      WHEN is_system THEN turn_user_id
      WHEN started_by = auth.uid() THEN partner_id
      ELSE started_by
    END,
    stage = CASE
      WHEN stops THEN 'done'
      WHEN stage = 'turns' AND turn_count + 1 >= max_turns THEN 'closing'
      ELSE stage
    END,
    status = CASE WHEN stops THEN 'stopped' ELSE status END,
    stop_flags = CASE WHEN stops THEN flags ELSE stop_flags END,
    stop_at = CASE WHEN stops THEN now() ELSE stop_at END,
    updated_at = now()
  WHERE id = p_session
  RETURNING * INTO s;

  RETURN jsonb_build_object('turn', to_jsonb(saved), 'session', to_jsonb(s), 'stopped', stops);
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_add_turn(uuid, text, text, boolean, text[], text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_add_turn(uuid, text, text, boolean, text[], text, text, int) TO authenticated, service_role;

-- ── 6. Reading: the one call the room screen needs ──────────────────────
CREATE OR REPLACE FUNCTION public.ftf_state(p_session uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.ftf_sessions%ROWTYPE;
  me uuid := auth.uid();
BEGIN
  IF NOT public.is_partner(me) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  IF p_session IS NULL THEN
    SELECT * INTO s FROM public.ftf_sessions
     WHERE (started_by = me OR partner_id = me OR partner_id IS NULL)
       AND status IN ('waiting', 'active', 'paused', 'stopped')
     ORDER BY updated_at DESC LIMIT 1;
  ELSE
    SELECT * INTO s FROM public.ftf_sessions WHERE id = p_session;
    IF FOUND AND (s.started_by <> me AND s.partner_id IS DISTINCT FROM me AND s.partner_id IS NOT NULL) THEN
      RAISE EXCEPTION 'That room is not yours';
    END IF;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('session', null, 'turns', '[]'::jsonb, 'me', me);
  END IF;

  RETURN jsonb_build_object(
    'session', to_jsonb(s),
    'turns', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'user_id', t.user_id, 'kind', t.kind, 'content', t.content,
        'softened', t.softened, 'flags', t.flags, 'created_at', t.created_at
      ) ORDER BY t.created_at)
      FROM public.ftf_turns t WHERE t.session_id = s.id
    ), '[]'::jsonb),
    'me', me,
    'my_turn', (s.turn_user_id = me AND s.status = 'active'),
    'i_agreed', (me = ANY(s.agreed_by)),
    'both_agreed', (array_length(s.agreed_by, 1) >= 2 AND s.partner_id IS NOT NULL),
    'waiting_for_partner', (s.partner_id IS NULL),
    'stopped', (s.status = 'stopped')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_state(uuid) TO authenticated, service_role;

-- Past rooms: what was said, what was agreed (the closing note).
CREATE OR REPLACE FUNCTION public.ftf_recent(p_limit integer DEFAULT 12)
RETURNS TABLE (id uuid, topic text, status text, turn_count int, created_at timestamptz, closed_at timestamptz, close_note text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.topic, s.status, s.turn_count, s.created_at, s.closed_at, s.close_note
  FROM public.ftf_sessions s
  WHERE public.is_partner(auth.uid())
    AND (s.started_by = auth.uid() OR s.partner_id = auth.uid())
  ORDER BY s.created_at DESC
  LIMIT greatest(coalesce(p_limit, 12), 1);
$$;
REVOKE ALL ON FUNCTION public.ftf_recent(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ftf_recent(integer) TO authenticated, service_role;

-- ── 7. Housekeeping (service role / nightly) ────────────────────────────
-- A room nobody touched for two days closes itself: a paused conversation is
-- kind, a forgotten one is not.
CREATE OR REPLACE FUNCTION public.ftf_sweep(p_idle_hours integer DEFAULT 48)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.ftf_sessions
     SET status = CASE WHEN status = 'stopped' THEN 'stopped' ELSE 'closed' END,
         stage = 'done',
         closed_at = now(),
         updated_at = now(),
         close_note = coalesce(close_note, 'Faded away — nobody came back to it.')
   WHERE status IN ('waiting', 'active', 'paused')
     AND updated_at < now() - make_interval(hours => greatest(coalesce(p_idle_hours, 48), 1));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.ftf_sweep(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ftf_sweep(integer) TO service_role;

-- ── 8. Verify ───────────────────────────────────────────────────────────
--   select public.ftf_open('the thing from last night');
--   select public.ftf_state();
--   select public.ftf_agree('<session-uuid>');
