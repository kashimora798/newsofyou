CREATE TABLE IF NOT EXISTS public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  banned_until timestamptz NOT NULL,
  ban_reason text,
  banned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_bans_user_created_at
  ON public.user_bans (user_id, created_at DESC);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

DROP POLICY IF EXISTS "Users can view own bans" ON public.user_bans;
CREATE POLICY "Users can view own bans"
  ON public.user_bans
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all bans" ON public.user_bans;
CREATE POLICY "Admins can view all bans"
  ON public.user_bans
  FOR SELECT
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can insert bans" ON public.user_bans;
CREATE POLICY "Admins can insert bans"
  ON public.user_bans
  FOR INSERT
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update bans" ON public.user_bans;
CREATE POLICY "Admins can update bans"
  ON public.user_bans
  FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.ban_user_for_five_minutes(target_user_id uuid, ban_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_bans (user_id, banned_until, ban_reason, banned_by)
  VALUES (
    target_user_id,
    now() + interval '5 minutes',
    COALESCE(ban_reason, 'Temporary moderation action'),
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ban_user_for_five_minutes(uuid, text) TO authenticated;
