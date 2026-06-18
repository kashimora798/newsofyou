-- Phase 1: Security hardening for the private couples chat.
--
-- Problem this fixes:
--   * messages SELECT/UPDATE were USING (true) -> any authenticated account could
--     read the entire private conversation and overwrite any message.
--   * Bans were enforced only in the React client, so a banned JWT could still
--     read/write via the API.
--   * A few tables exposed rows to every authenticated user instead of partners.
--
-- Strategy: this app has exactly two real users (role 'partner') plus an 'admin'.
-- We scope access to "is a partner/admin" and "is not currently banned", enforced
-- in the database so the client can no longer be bypassed.
--
-- Defensive: base tables live in the remote DB; everything here is idempotent.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- True when the given user is a real chat participant (partner or admin).
-- Role of record lives on public.users (see useUserRole + current_user_is_admin).
CREATE OR REPLACE FUNCTION public.is_partner(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = uid AND role IN ('partner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_partner(uuid) TO authenticated;

-- True when the given user has an active (not yet expired) ban.
CREATE OR REPLACE FUNCTION public.is_banned(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_bans
    WHERE user_id = uid AND banned_until > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- messages: replace permissive policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read all messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can reveal secret messages" ON public.messages;
DROP POLICY IF EXISTS "Partners can read messages" ON public.messages;
DROP POLICY IF EXISTS "Partners can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Owners can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Partners can update receipt fields" ON public.messages;

-- Only partners who are not banned can read the conversation.
CREATE POLICY "Partners can read messages"
ON public.messages FOR SELECT
TO authenticated
USING (public.is_partner(auth.uid()) AND NOT public.is_banned(auth.uid()));

-- Only partners who are not banned can send, and only as themselves.
CREATE POLICY "Partners can insert their own messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_partner(auth.uid())
  AND NOT public.is_banned(auth.uid())
);

-- The owner may update their own message (edits, link previews, etc.).
CREATE POLICY "Owners can update their own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND NOT public.is_banned(auth.uid()))
WITH CHECK (auth.uid() = user_id);

-- The partner may update rows they did NOT author (to mark seen/delivered/revealed).
-- A trigger (below) ensures such updates can only touch receipt/reveal columns.
CREATE POLICY "Partners can update receipt fields"
ON public.messages FOR UPDATE
TO authenticated
USING (
  auth.uid() <> user_id
  AND public.is_partner(auth.uid())
  AND NOT public.is_banned(auth.uid())
)
WITH CHECK (auth.uid() <> user_id);

-- Guard: when a non-owner updates a message, only receipt/reveal columns may change.
-- This is what RLS alone cannot express (column-level write scoping).
CREATE OR REPLACE FUNCTION public.enforce_message_receipt_only_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner edits are unrestricted; only police non-owner updates.
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id THEN
    IF NEW.content      IS DISTINCT FROM OLD.content
       OR NEW.message_type IS DISTINCT FROM OLD.message_type
       OR NEW.user_id   IS DISTINCT FROM OLD.user_id
       OR NEW.username  IS DISTINCT FROM OLD.username
       OR NEW.file_url  IS DISTINCT FROM OLD.file_url
       OR NEW.gif_url   IS DISTINCT FROM OLD.gif_url
       OR NEW.sticker_url IS DISTINCT FROM OLD.sticker_url
       OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Only receipt fields may be updated on a partner''s message';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_receipt_only_update ON public.messages;
CREATE TRIGGER trg_enforce_message_receipt_only_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_receipt_only_update();

-- ---------------------------------------------------------------------------
-- Input hardening: message length + flood guard
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_length_chk;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length_chk
  CHECK (content IS NULL OR char_length(content) <= 40000);

-- Soft anti-flood: at most 50 inserts per user per rolling 10 seconds.
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.messages
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '10 seconds';

  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'Sending too fast. Please slow down.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_rate_limit ON public.messages;
CREATE TRIGGER trg_enforce_message_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_rate_limit();

-- ---------------------------------------------------------------------------
-- Tighten other partner-only tables (were auth.role()='authenticated')
-- ---------------------------------------------------------------------------

-- pinned_messages: anyone authenticated could read. Restrict SELECT to partners.
DROP POLICY IF EXISTS "Authenticated users can view pinned messages" ON public.pinned_messages;
DROP POLICY IF EXISTS "Partners can view pinned messages" ON public.pinned_messages;
CREATE POLICY "Partners can view pinned messages"
  ON public.pinned_messages FOR SELECT
  TO authenticated
  USING (public.is_partner(auth.uid()));

-- pending_animations: SELECT/DELETE are already scoped to target_user_id.
-- Tighten INSERT so only partners can enqueue animations.
DROP POLICY IF EXISTS "Authenticated users can insert pending animations" ON public.pending_animations;
DROP POLICY IF EXISTS "Partners can insert pending animations" ON public.pending_animations;
CREATE POLICY "Partners can insert pending animations"
  ON public.pending_animations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_partner(auth.uid()));

-- message_reactions: ensure only partners can read reactions.
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Partners can view reactions" ON public.message_reactions;
CREATE POLICY "Partners can view reactions"
  ON public.message_reactions FOR SELECT
  TO authenticated
  USING (public.is_partner(auth.uid()));
