CREATE OR REPLACE FUNCTION public.ban_user_for_five_minutes(target_user_id uuid, ban_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_user_id IS DISTINCT FROM actor_id AND NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_bans (user_id, banned_until, ban_reason, banned_by)
  VALUES (
    target_user_id,
    now() + interval '5 minutes',
    COALESCE(ban_reason, 'Temporary moderation action'),
    actor_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ban_user_for_five_minutes(uuid, text) TO authenticated;
