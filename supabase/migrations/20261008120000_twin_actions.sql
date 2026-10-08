-- Phase 7 — assistant actions, always behind a confirm card.
-- ============================================================================
-- The twin may *propose*. A person taps. Only then does anything get written.
--
-- Six kinds (build-plan §Phase 7):
--   schedule_message   send something later, in her/his name
--   create_reminder    a reminder for either of them
--   add_event          a date on the shared calendar
--   format_message     rewrite a draft (nothing is stored but the suggestion)
--   daily_summary      "how was today?" — read-only, one call, cached
--   plan               "what should we do this weekend?" — read-only
--
-- The row is the whole contract:
--   status = proposed → (a person taps) → confirmed → (the function runs) → done
--                                         → cancelled / expired
-- Nothing executes on `proposed`. `twin_action_confirm` records the tap and hands
-- back the frozen payload; the edge function then performs the write with the
-- service role. That is what makes "confirm-card only" auditable in one table.
--
-- Idempotent; nothing dropped; `messages` is never written.

CREATE TABLE IF NOT EXISTS public.twin_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,                -- whose tap is required
  kind          text NOT NULL,                -- schedule_message|create_reminder|add_event|format_message|daily_summary|plan
  status        text NOT NULL DEFAULT 'proposed',
  title         text NOT NULL,
  detail        text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview       text,                         -- what will be written, verbatim
  when_at       timestamptz,                  -- for the three write kinds
  source        text NOT NULL DEFAULT 'twin_chat', -- twin_chat|chat|home|control_room
  conversation_id bigint REFERENCES public.twin_conversations(id) ON DELETE SET NULL,
  message_id    uuid,                         -- the message it came from, if any
  model         text,
  tokens        int,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  decided_at    timestamptz,
  executed_at   timestamptz,
  result        jsonb,
  error         text
);

CREATE INDEX IF NOT EXISTS idx_twin_actions_open
  ON public.twin_actions (user_id, created_at DESC)
  WHERE status IN ('proposed', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_twin_actions_recent
  ON public.twin_actions (created_at DESC);

ALTER TABLE public.twin_actions ENABLE ROW LEVEL SECURITY;

-- Only the person whose tap it needs (and the partner, read-only, for the
-- write kinds that were shared) may read a proposal.
DROP POLICY IF EXISTS "own twin actions" ON public.twin_actions;
CREATE POLICY "own twin actions" ON public.twin_actions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.is_partner(auth.uid()) AND kind IN ('schedule_message','create_reminder','add_event')));

DROP POLICY IF EXISTS "own twin actions update" ON public.twin_actions;
CREATE POLICY "own twin actions update" ON public.twin_actions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.twin_actions FROM anon;
GRANT SELECT, UPDATE ON TABLE public.twin_actions TO authenticated;
GRANT ALL ON TABLE public.twin_actions TO service_role;

-- ── 1. Propose (the AI's only write) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.twin_action_propose(
  p_kind text,
  p_title text,
  p_detail text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_preview text DEFAULT NULL,
  p_when timestamptz DEFAULT NULL,
  p_source text DEFAULT 'twin_chat',
  p_conversation bigint DEFAULT NULL,
  p_message_id uuid DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_tokens int DEFAULT NULL,
  p_for_user uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  target uuid;
  saved public.twin_actions%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF p_kind NOT IN ('schedule_message','create_reminder','add_event','format_message','daily_summary','plan') THEN
    RAISE EXCEPTION 'Unknown action kind: %', p_kind;
  END IF;

  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  target := coalesce(p_for_user, auth.uid());
  -- she may ask for something in his name, he in hers; nobody else exists
  IF target <> auth.uid() AND target <> cfg.partner_user_id AND target <> cfg.owner_user_id THEN
    RAISE EXCEPTION 'That person is not part of this twin';
  END IF;

  -- one open card of a kind at a time: no pile-up of duplicates
  UPDATE public.twin_actions
     SET status = 'cancelled', decided_at = now(), error = 'superseded'
   WHERE user_id = auth.uid() AND status = 'proposed' AND kind = p_kind
     AND coalesce(preview, '') = coalesce(p_preview, '') AND p_kind IN ('daily_summary', 'plan');

  INSERT INTO public.twin_actions (
    user_id, kind, title, detail, payload, preview, when_at, source, conversation_id, message_id, model, tokens
  ) VALUES (
    auth.uid(), p_kind, left(coalesce(p_title, 'something'), 120), left(p_detail, 400),
    coalesce(p_payload, '{}'::jsonb), left(p_preview, 1000), p_when,
    coalesce(p_source, 'twin_chat'), p_conversation, p_message_id, p_model, p_tokens
  )
  RETURNING * INTO saved;

  RETURN to_jsonb(saved);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_action_propose(text, text, text, jsonb, text, timestamptz, text, bigint, uuid, text, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_action_propose(text, text, text, jsonb, text, timestamptz, text, bigint, uuid, text, int, uuid) TO authenticated, service_role;

-- ── 2. The tap ──────────────────────────────────────────────────────────
-- Records the decision and hands the frozen payload back. This function never
-- performs the write; the caller does, with the service role.
CREATE OR REPLACE FUNCTION public.twin_action_decide(p_id uuid, p_confirm boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.twin_actions%ROWTYPE;
BEGIN
  SELECT * INTO row FROM public.twin_actions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such action';
  IF row.user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the person it was proposed to can decide'; END IF;

  IF row.status = 'proposed' AND row.expires_at < now() THEN
    UPDATE public.twin_actions SET status = 'expired', decided_at = now() WHERE id = p_id;
    RETURN jsonb_build_object('ok', false, 'status', 'expired', 'reason', 'expired');
  END IF;

  IF row.status <> 'proposed' THEN
    RETURN jsonb_build_object('ok', false, 'status', row.status, 'reason', 'already_decided', 'action', to_jsonb(row));
  END IF;

  UPDATE public.twin_actions
     SET status = CASE WHEN coalesce(p_confirm, true) THEN 'confirmed' ELSE 'cancelled' END,
         decided_at = now()
   WHERE id = p_id
  RETURNING * INTO row;

  RETURN jsonb_build_object(
    'ok', true,
    'status', row.status,
    'action', to_jsonb(row),
    -- what the caller is now allowed to write, exactly as it was shown
    'payload', row.payload
  );
END;
$$;
REVOKE ALL ON FUNCTION public.twin_action_decide(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_action_decide(uuid, boolean) TO authenticated, service_role;

-- ── 3. Recording the outcome (service role) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.twin_action_finish(
  p_id uuid,
  p_status text DEFAULT 'done',
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.twin_actions%ROWTYPE;
BEGIN
  UPDATE public.twin_actions
     SET status = CASE WHEN p_status IN ('done','failed') THEN p_status ELSE 'done' END,
         executed_at = now(),
         result = coalesce(p_result, '{}'::jsonb),
         error = left(p_error, 300)
   WHERE id = p_id AND status IN ('confirmed', 'done', 'failed')
  RETURNING * INTO updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_confirmed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', to_jsonb(updated));
END;
$$;
REVOKE ALL ON FUNCTION public.twin_action_finish(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_action_finish(uuid, text, jsonb, text) TO service_role;

-- ── 3b. Reads (a summary, a plan) still deserve an audit row ───────────
-- service role only: these never needed a tap, because they write nothing.
CREATE OR REPLACE FUNCTION public.twin_action_record(
  p_user uuid,
  p_kind text,
  p_title text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_model text DEFAULT NULL,
  p_tokens int DEFAULT NULL,
  p_source text DEFAULT 'twin_chat'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.twin_actions%ROWTYPE;
BEGIN
  IF p_kind NOT IN ('format_message','daily_summary','plan') THEN
    RAISE EXCEPTION 'Only read kinds can be recorded directly';
  END IF;

  INSERT INTO public.twin_actions (user_id, kind, status, title, payload, model, tokens, source, decided_at, executed_at, result)
  VALUES (p_user, p_kind, 'done', left(coalesce(p_title, 'done'), 120), coalesce(p_payload, '{}'::jsonb),
          p_model, p_tokens, coalesce(p_source, 'twin_chat'), now(), now(), coalesce(p_result, '{}'::jsonb))
  RETURNING * INTO saved;

  RETURN jsonb_build_object('ok', true, 'action', to_jsonb(saved));
END;
$$;
REVOKE ALL ON FUNCTION public.twin_action_record(uuid, text, text, jsonb, jsonb, text, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_action_record(uuid, text, text, jsonb, jsonb, text, int, text) TO service_role;

-- ── 4. Reading them ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.twin_actions_list(p_limit integer DEFAULT 20, p_open_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'open', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'status', a.status, 'title', a.title, 'detail', a.detail,
        'preview', a.preview, 'when_at', a.when_at, 'payload', a.payload,
        'expires_at', a.expires_at, 'created_at', a.created_at
      ) ORDER BY a.created_at DESC)
      FROM public.twin_actions a
      WHERE a.user_id = auth.uid() AND a.status IN ('proposed', 'confirmed')
    ), '[]'::jsonb),
    'recent', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'status', a.status, 'title', a.title,
        'when_at', a.when_at, 'result', a.result, 'error', a.error,
        'created_at', a.created_at, 'executed_at', a.executed_at
      ) ORDER BY a.created_at DESC)
      FROM (
        SELECT * FROM public.twin_actions
        WHERE user_id = auth.uid() AND (NOT coalesce(p_open_only, false) OR status <> 'proposed')
        ORDER BY created_at DESC LIMIT greatest(coalesce(p_limit, 20), 1)
      ) a
    ), '[]'::jsonb),
    'counts', (
      SELECT jsonb_build_object(
        'proposed', count(*) FILTER (WHERE status = 'proposed'),
        'confirmed', count(*) FILTER (WHERE status = 'confirmed'),
        'done', count(*) FILTER (WHERE status = 'done'),
        'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
        'failed', count(*) FILTER (WHERE status = 'failed')
      )
      FROM public.twin_actions WHERE user_id = auth.uid()
    )
  )
  WHERE public.is_partner(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.twin_actions_list(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_actions_list(integer, boolean) TO authenticated, service_role;

-- ── 5. Expiry: nothing lingers forever ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.twin_actions_expire()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.twin_actions
     SET status = 'expired', decided_at = now(), error = coalesce(error, 'expired')
   WHERE status = 'proposed' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.twin_actions_expire() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_actions_expire() TO service_role;

-- ── 6. Verify ───────────────────────────────────────────────────────────
--   select public.twin_actions_list(10);
--   select public.twin_action_propose('create_reminder', 'Call mum', null,
--          '{"title":"Call mum","remind_at":"2026-10-09T19:00:00+05:30"}'::jsonb,
--          'Call mum — Friday 9 Oct, 7:00 pm', '2026-10-09T13:30:00Z');
