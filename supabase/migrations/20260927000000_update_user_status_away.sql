-- Migration: Update update_user_status to support p_activity_state and automatic offline/away handling

DROP FUNCTION IF EXISTS public.update_user_status(uuid, boolean, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.update_user_status(
  p_user_id uuid, 
  p_is_online boolean, 
  p_last_seen timestamp with time zone DEFAULT now(),
  p_activity_state text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_status (user_id, is_online, last_seen, updated_at, activity_state)
  VALUES (
    p_user_id, 
    p_is_online, 
    p_last_seen, 
    now(), 
    COALESCE(p_activity_state, CASE WHEN p_is_online THEN 'active' ELSE 'offline' END)
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    is_online = EXCLUDED.is_online,
    last_seen = EXCLUDED.last_seen,
    updated_at = now(),
    activity_state = COALESCE(
      p_activity_state, 
      CASE WHEN EXCLUDED.is_online THEN public.user_status.activity_state ELSE 'offline' END
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_user_status(uuid, boolean, timestamp with time zone, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_status(uuid, boolean, timestamp with time zone, text) TO anon;
