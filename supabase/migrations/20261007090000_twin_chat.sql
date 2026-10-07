-- Phase 4: the twin's chat — her private conversations, plus the "he's away"
-- auto-reply that answers in his place (build-plan §Phase 4 + §7.3).
--
--   twin_conversations  one thread per partner; private to her by default
--   twin_messages       both sides of that thread (role: partner|twin)
--   twin_auto_replies   what the twin said in the shared chat while he was
--                       offline — kept OUT of `messages` on purpose
--
-- Why a separate table for auto-replies: rule #1 of this project says `messages`
-- is read-only. Rather than writing AI text into the couple's real history, the
-- auto-reply lives here and the chat renders it as a labelled AI note that he
-- can accept (by simply replying) or remove. Nothing the twin says can ever
-- masquerade as something he typed.

-- ── 1. Conversations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twin_conversations (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,                       -- whose thread this is (her)
  title text NOT NULL DEFAULT 'New chat',
  visibility text NOT NULL DEFAULT 'private',  -- private (only she sees it) | shared (he may read)
  msg_count int NOT NULL DEFAULT 0,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS twin_conversations_user_idx
  ON public.twin_conversations (user_id, last_active_at DESC);

ALTER TABLE public.twin_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twin_conversations FROM anon;
-- Her own threads, or a shared one the other partner may read.
DROP POLICY IF EXISTS "own twin conversations" ON public.twin_conversations;
CREATE POLICY "own twin conversations" ON public.twin_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (visibility = 'shared' AND public.is_partner(auth.uid())))
  WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.twin_conversations TO authenticated;
GRANT ALL ON TABLE public.twin_conversations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.twin_conversations_id_seq TO authenticated, service_role;

-- ── 2. Messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twin_messages (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES public.twin_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,                          -- partner | twin
  content text NOT NULL,
  mood text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,  -- proposed actions (Phase 7)
  model text,
  tokens int,
  guarded boolean NOT NULL DEFAULT false,      -- true = the reply was replaced by a safe line
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS twin_messages_conversation_idx
  ON public.twin_messages (conversation_id, created_at);

ALTER TABLE public.twin_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twin_messages FROM anon;
DROP POLICY IF EXISTS "read twin messages of visible threads" ON public.twin_messages;
CREATE POLICY "read twin messages of visible threads" ON public.twin_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.twin_conversations c
    WHERE c.id = conversation_id
      AND (c.user_id = auth.uid() OR (c.visibility = 'shared' AND public.is_partner(auth.uid())))
  ));
-- Writes go through the RPCs below (the twin's replies) or the sender's own thread.
DROP POLICY IF EXISTS "insert own twin messages" ON public.twin_messages;
CREATE POLICY "insert own twin messages" ON public.twin_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.twin_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "delete own twin messages" ON public.twin_messages;
CREATE POLICY "delete own twin messages" ON public.twin_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.twin_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));
GRANT SELECT, INSERT, DELETE ON TABLE public.twin_messages TO authenticated;
GRANT ALL ON TABLE public.twin_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.twin_messages_id_seq TO authenticated, service_role;

-- ── 3. Auto-replies (the twin answering while he is away) ────────────────
CREATE TABLE IF NOT EXISTS public.twin_auto_replies (
  id bigserial PRIMARY KEY,
  reply_to_message_id uuid,                    -- the message she sent that went unanswered
  for_user_id uuid NOT NULL,                   -- the partner the twin wrote to
  text text NOT NULL,
  mood text,
  model text,
  source text NOT NULL DEFAULT 'auto',         -- auto | manual
  status text NOT NULL DEFAULT 'standing',     -- standing | superseded | dismissed
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS twin_auto_replies_user_idx
  ON public.twin_auto_replies (for_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS twin_auto_replies_status_idx
  ON public.twin_auto_replies (status, created_at DESC);

ALTER TABLE public.twin_auto_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twin_auto_replies FROM anon;
-- Both partners may read them: he needs to see what was said in his name, and
-- she needs to see it too (it was shown to her in the chat).
DROP POLICY IF EXISTS "partners read auto replies" ON public.twin_auto_replies;
CREATE POLICY "partners read auto replies" ON public.twin_auto_replies
  FOR SELECT TO authenticated
  USING (public.is_partner(auth.uid()));
GRANT SELECT ON TABLE public.twin_auto_replies TO authenticated;
GRANT ALL ON TABLE public.twin_auto_replies TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.twin_auto_replies_id_seq TO service_role;

-- ── 4. Config additions ──────────────────────────────────────────────────
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS twin_chat_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS auto_reply_after_minutes int NOT NULL DEFAULT 25;
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS auto_reply_max_per_day int NOT NULL DEFAULT 3;
ALTER TABLE public.twin_config ADD COLUMN IF NOT EXISTS auto_reply_min_gap_minutes int NOT NULL DEFAULT 45;

-- ── 5. Thread RPCs (her side) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.twin_conversation_list(p_limit integer DEFAULT 40)
RETURNS TABLE (id bigint, title text, visibility text, msg_count int, last_active_at timestamptz, preview text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.title, c.visibility, c.msg_count, c.last_active_at,
         (SELECT left(m.content, 90) FROM public.twin_messages m
           WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS preview
  FROM public.twin_conversations c
  WHERE c.user_id = auth.uid()
  ORDER BY c.last_active_at DESC
  LIMIT greatest(coalesce(p_limit, 40), 1);
$$;
REVOKE ALL ON FUNCTION public.twin_conversation_list(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_conversation_list(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.twin_conversation_create(p_title text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  created public.twin_conversations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Twin is not configured'; END IF;

  INSERT INTO public.twin_conversations (user_id, title, visibility)
  VALUES (
    auth.uid(),
    coalesce(nullif(btrim(p_title), ''), 'New chat'),
    'private'                     -- always private at birth (build-plan §7.3)
  )
  RETURNING * INTO created;

  RETURN jsonb_build_object(
    'id', created.id,
    'title', created.title,
    'visibility', created.visibility,
    'msg_count', created.msg_count,
    'last_active_at', created.last_active_at,
    'preview', null
  );
END;
$$;
REVOKE ALL ON FUNCTION public.twin_conversation_create(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_conversation_create(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.twin_conversation_messages(
  p_conversation bigint,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (id bigint, role text, content text, mood text, actions jsonb, guarded boolean, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.role, m.content, m.mood, m.actions, m.guarded, m.created_at
  FROM public.twin_messages m
  JOIN public.twin_conversations c ON c.id = m.conversation_id
  WHERE m.conversation_id = p_conversation
    AND (c.user_id = auth.uid() OR (c.visibility = 'shared' AND public.is_partner(auth.uid())))
  ORDER BY m.created_at ASC
  LIMIT greatest(coalesce(p_limit, 40), 1);
$$;
REVOKE ALL ON FUNCTION public.twin_conversation_messages(bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_conversation_messages(bigint, integer) TO authenticated, service_role;

-- The only way to change visibility — and only the owner of the thread can.
CREATE OR REPLACE FUNCTION public.twin_conversation_set_visibility(p_conversation bigint, p_shared boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.twin_conversations%ROWTYPE;
BEGIN
  UPDATE public.twin_conversations
     SET visibility = CASE WHEN coalesce(p_shared, false) THEN 'shared' ELSE 'private' END
   WHERE id = p_conversation AND user_id = auth.uid()
  RETURNING * INTO updated;

  IF NOT FOUND THEN RAISE EXCEPTION 'That conversation is not yours'; END IF;
  RETURN jsonb_build_object('id', updated.id, 'visibility', updated.visibility);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_conversation_set_visibility(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_conversation_set_visibility(bigint, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.twin_conversation_rename(p_conversation bigint, p_title text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.twin_conversations%ROWTYPE;
BEGIN
  UPDATE public.twin_conversations
     SET title = left(coalesce(nullif(btrim(p_title), ''), title), 80)
   WHERE id = p_conversation AND user_id = auth.uid()
  RETURNING * INTO updated;

  IF NOT FOUND THEN RAISE EXCEPTION 'That conversation is not yours'; END IF;
  RETURN jsonb_build_object('id', updated.id, 'title', updated.title);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_conversation_rename(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_conversation_rename(bigint, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.twin_conversation_delete(p_conversation bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed int;
BEGIN
  DELETE FROM public.twin_conversations WHERE id = p_conversation AND user_id = auth.uid();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN jsonb_build_object('deleted', removed);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_conversation_delete(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_conversation_delete(bigint) TO authenticated, service_role;

-- ── 6. Appending turns (the edge function writes both sides) ─────────────
CREATE OR REPLACE FUNCTION public.twin_message_append(
  p_conversation bigint,
  p_role text,
  p_content text,
  p_mood text DEFAULT NULL,
  p_actions jsonb DEFAULT '[]'::jsonb,
  p_model text DEFAULT NULL,
  p_tokens int DEFAULT NULL,
  p_guarded boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  conv public.twin_conversations%ROWTYPE;
  saved public.twin_messages%ROWTYPE;
BEGIN
  SELECT * INTO conv FROM public.twin_conversations WHERE id = p_conversation;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such conversation'; END IF;

  -- service_role may write both sides; a signed-in partner may only write their own words
  IF auth.uid() IS NOT NULL THEN
    IF conv.user_id <> auth.uid() THEN RAISE EXCEPTION 'That conversation is not yours'; END IF;
    IF p_role <> 'partner' THEN RAISE EXCEPTION 'Only the twin may write as the twin'; END IF;
  END IF;

  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;

  INSERT INTO public.twin_messages (conversation_id, role, content, mood, actions, model, tokens, guarded)
  VALUES (p_conversation, p_role, left(coalesce(p_content, ''), 4000), p_mood,
          coalesce(p_actions, '[]'::jsonb), p_model, p_tokens, coalesce(p_guarded, false))
  RETURNING * INTO saved;

  UPDATE public.twin_conversations
     SET msg_count = msg_count + 1,
         last_active_at = now(),
         -- first thing she says becomes the thread's name
         title = CASE
           WHEN title = 'New chat' AND p_role = 'partner'
             THEN left(regexp_replace(coalesce(p_content, ''), '\s+', ' ', 'g'), 48)
           ELSE title
         END
   WHERE id = p_conversation;

  RETURN to_jsonb(saved);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_message_append(bigint, text, text, text, jsonb, text, int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_message_append(bigint, text, text, text, jsonb, text, int, boolean) TO authenticated, service_role;

-- ── 7. Auto-reply: may the twin answer in his place right now? ───────────
-- Everything is decided here, in one place, so the rule is auditable:
--   * consent + the switch must both be on
--   * he must actually be away (offline, and past the delay)
--   * her last message must be unanswered and not already answered by the twin
--   * at most N per day, and at least a gap between two of them
--   * never while she is mid-conversation with him (he replied after her)
CREATE OR REPLACE FUNCTION public.twin_autoreply_state(p_for_user uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.twin_config%ROWTYPE;
  target uuid;
  status_row record;
  last_msg record;
  last_auto record;
  today_count int;
  minutes_since_last_reply numeric;
  minutes_since_her_message numeric;
  answered boolean;
  eligible boolean := true;
  reason text := 'ok';
BEGIN
  SELECT * INTO cfg FROM public.twin_config WHERE id = 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'reason', 'not_configured'); END IF;

  target := coalesce(p_for_user, cfg.partner_user_id);

  IF cfg.partner_consented_at IS NULL OR cfg.twin_enabled = false THEN
    eligible := false; reason := 'no_consent';
  ELSIF cfg.auto_reply_enabled = false THEN
    eligible := false; reason := 'off';
  END IF;

  -- the other side of the couple must be the owner (the twin speaks as him)
  IF target = cfg.owner_user_id THEN
    eligible := false; reason := 'wrong_side';
  END IF;

  SELECT u.last_seen, u.is_online, u.activity_state
    INTO status_row
  FROM public.user_status u
  WHERE u.user_id = cfg.owner_user_id
  LIMIT 1;

  -- her most recent message in the shared chat
  SELECT m.id, m.created_at, m.user_id
    INTO last_msg
  FROM public.messages m
  WHERE m.user_id = target
    AND NOT public.twin_is_ignored_message(m.message_type)
    AND NOT public.twin_is_placeholder_content(m.content)
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF last_msg.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_messages');
  END IF;

  -- did he (or anyone else) answer after her?
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.created_at > last_msg.created_at
      AND m.user_id <> target
      AND NOT public.twin_is_ignored_message(m.message_type)
  ) INTO answered;

  minutes_since_her_message := extract(epoch FROM (now() - last_msg.created_at)) / 60.0;
  minutes_since_last_reply := CASE
    WHEN status_row.last_seen IS NULL THEN NULL
    ELSE extract(epoch FROM (now() - status_row.last_seen)) / 60.0
  END;

  IF eligible THEN
    IF coalesce(status_row.is_online, false) AND coalesce(status_row.activity_state, 'offline') <> 'offline' THEN
      eligible := false; reason := 'he_is_online';
    ELSIF minutes_since_her_message < greatest(cfg.auto_reply_after_minutes, 1) THEN
      eligible := false; reason := 'too_soon';
    ELSIF answered THEN
      eligible := false; reason := 'already_answered';
    END IF;
  END IF;

  -- how many has the twin sent today, and when was the last one?
  SELECT count(*) INTO today_count
  FROM public.twin_auto_replies r
  WHERE r.for_user_id = target
    AND r.status <> 'dismissed'
    AND (r.created_at AT TIME ZONE cfg.timezone)::date = (now() AT TIME ZONE cfg.timezone)::date;

  SELECT r.created_at, r.id INTO last_auto
  FROM public.twin_auto_replies r
  WHERE r.for_user_id = target AND r.status <> 'dismissed'
  ORDER BY r.created_at DESC LIMIT 1;

  IF eligible THEN
    IF today_count >= greatest(cfg.auto_reply_max_per_day, 0) THEN
      eligible := false; reason := 'daily_limit';
    ELSIF last_auto.created_at IS NOT NULL
      AND extract(epoch FROM (now() - last_auto.created_at)) / 60.0 < greatest(cfg.auto_reply_min_gap_minutes, 1) THEN
      eligible := false; reason := 'gap';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible', eligible,
    'reason', reason,
    'for_user', target,
    'reply_to_message_id', last_msg.id,
    'minutes_since_her_message', round(minutes_since_her_message),
    'minutes_since_his_seen', round(minutes_since_last_reply),
    'sent_today', today_count,
    'daily_limit', cfg.auto_reply_max_per_day,
    'delay_minutes', cfg.auto_reply_after_minutes
  );
END;
$$;
REVOKE ALL ON FUNCTION public.twin_autoreply_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_autoreply_state(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.twin_autoreply_log(
  p_for_user uuid,
  p_text text,
  p_mood text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_reply_to uuid DEFAULT NULL,
  p_source text DEFAULT 'auto'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.twin_auto_replies%ROWTYPE;
BEGIN
  -- a newer twin reply supersedes an older one that he never followed up
  UPDATE public.twin_auto_replies
     SET status = 'superseded'
   WHERE for_user_id = p_for_user AND status = 'standing';

  INSERT INTO public.twin_auto_replies (reply_to_message_id, for_user_id, text, mood, model, source)
  VALUES (p_reply_to, p_for_user, left(coalesce(p_text, ''), 1200), p_mood, p_model, coalesce(p_source, 'auto'))
  RETURNING * INTO saved;

  RETURN to_jsonb(saved);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_autoreply_log(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.twin_autoreply_log(uuid, text, text, text, uuid, text) TO service_role;

-- What the chat shows: the standing replies in the last day, plus the state of
-- things, so the chat can render an honest "the twin answered while he was away".
CREATE OR REPLACE FUNCTION public.twin_autoreply_for_chat(p_hours integer DEFAULT 48)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', (SELECT auto_reply_enabled AND partner_consented_at IS NOT NULL AND twin_enabled
                FROM public.twin_config WHERE id = 1),
    'replies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'text', r.text,
        'mood', r.mood,
        'created_at', r.created_at,
        'seen_at', r.seen_at,
        'status', r.status,
        'reply_to_message_id', r.reply_to_message_id
      ) ORDER BY r.created_at)
      FROM public.twin_auto_replies r
      WHERE r.status = 'standing'
        AND r.created_at > now() - make_interval(hours => greatest(coalesce(p_hours, 48), 1))
    ), '[]'::jsonb)
  )
  WHERE public.is_partner(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.twin_autoreply_for_chat(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_autoreply_for_chat(integer) TO authenticated, service_role;

-- He marks them as seen (so the "the twin answered" note stops nagging).
CREATE OR REPLACE FUNCTION public.twin_autoreply_ack(p_ids bigint[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched int;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  UPDATE public.twin_auto_replies
     SET seen_at = now(),
         status = CASE WHEN status = 'standing' THEN 'superseded' ELSE status END
   WHERE (p_ids IS NULL OR id = ANY (p_ids));
  GET DIAGNOSTICS touched = ROW_COUNT;

  RETURN jsonb_build_object('updated', touched);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_autoreply_ack(bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_autoreply_ack(bigint[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.twin_autoreply_dismiss(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched int;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  UPDATE public.twin_auto_replies SET status = 'dismissed', seen_at = coalesce(seen_at, now()) WHERE id = p_id;
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN jsonb_build_object('updated', touched);
END;
$$;
REVOKE ALL ON FUNCTION public.twin_autoreply_dismiss(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_autoreply_dismiss(bigint) TO authenticated, service_role;

-- ── 8. Owner switches (chat + auto-reply rules) ──────────────────────────
CREATE OR REPLACE FUNCTION public.twin_set_automation(
  p_auto_reply_enabled boolean DEFAULT NULL,
  p_after_minutes integer DEFAULT NULL,
  p_max_per_day integer DEFAULT NULL,
  p_min_gap_minutes integer DEFAULT NULL,
  p_twin_chat_enabled boolean DEFAULT NULL
)
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

  UPDATE public.twin_config SET
    auto_reply_enabled = coalesce(p_auto_reply_enabled, auto_reply_enabled),
    auto_reply_after_minutes = greatest(coalesce(p_after_minutes, auto_reply_after_minutes), 5),
    auto_reply_max_per_day = least(greatest(coalesce(p_max_per_day, auto_reply_max_per_day), 0), 12),
    auto_reply_min_gap_minutes = greatest(coalesce(p_min_gap_minutes, auto_reply_min_gap_minutes), 15),
    twin_chat_enabled = coalesce(p_twin_chat_enabled, twin_chat_enabled)
  WHERE id = 1
  RETURNING * INTO cfg;

  RETURN jsonb_build_object(
    'auto_reply_enabled', cfg.auto_reply_enabled,
    'auto_reply_after_minutes', cfg.auto_reply_after_minutes,
    'auto_reply_max_per_day', cfg.auto_reply_max_per_day,
    'auto_reply_min_gap_minutes', cfg.auto_reply_min_gap_minutes,
    'twin_chat_enabled', cfg.twin_chat_enabled
  );
END;
$$;
REVOKE ALL ON FUNCTION public.twin_set_automation(boolean, integer, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_set_automation(boolean, integer, integer, integer, boolean) TO authenticated, service_role;

-- What she may do: open her own twin chat (needs `twin_chat_enabled`, unless
-- she is the owner testing it).
CREATE OR REPLACE FUNCTION public.twin_chat_allowed()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'allowed', (c.twin_chat_enabled OR c.owner_user_id = auth.uid())
               AND c.partner_consented_at IS NOT NULL
               AND c.twin_enabled,
    'consented', c.partner_consented_at IS NOT NULL,
    'enabled', c.twin_enabled,
    'chat_enabled', c.twin_chat_enabled,
    'owner_name', c.owner_name,
    'is_owner', c.owner_user_id = auth.uid()
  )
  FROM public.twin_config c WHERE c.id = 1;
$$;
REVOKE ALL ON FUNCTION public.twin_chat_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_chat_allowed() TO authenticated, service_role;

-- ── 9. A tiny usage readout for the control room ─────────────────────────
CREATE OR REPLACE FUNCTION public.twin_chat_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'conversations', (SELECT count(*) FROM public.twin_conversations WHERE user_id = auth.uid()),
    'shared', (SELECT count(*) FROM public.twin_conversations WHERE user_id = auth.uid() AND visibility = 'shared'),
    'messages', (SELECT count(*) FROM public.twin_messages m
                  JOIN public.twin_conversations c ON c.id = m.conversation_id
                  WHERE c.user_id = auth.uid()),
    'auto_replies_7d', (SELECT count(*) FROM public.twin_auto_replies
                         WHERE status <> 'dismissed' AND created_at > now() - interval '7 days'),
    'tokens_30d', (SELECT coalesce(sum(m.tokens), 0) FROM public.twin_messages m
                    JOIN public.twin_conversations c ON c.id = m.conversation_id
                    WHERE c.user_id = auth.uid() AND m.created_at > now() - interval '30 days')
  )
  WHERE public.is_partner(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.twin_chat_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.twin_chat_stats() TO authenticated, service_role;
