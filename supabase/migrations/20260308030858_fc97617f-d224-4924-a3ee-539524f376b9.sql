
-- Fix messages RLS: Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can read all messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can reveal secret messages" ON public.messages;

-- Recreate as PERMISSIVE (default) so realtime works properly
CREATE POLICY "Users can read all messages"
ON public.messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update messages"
ON public.messages FOR UPDATE
TO authenticated
USING (true);

-- Add pinned_messages to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;
