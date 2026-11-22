-- Streak fix: PostgREST caps every query at 1000 rows, so the old client-side
-- streak maths only ever saw the newest ~1000 messages (≈ the last 56 days of
-- chatting) and the streak got stuck at that number.
--
-- This function returns ONE row per calendar day that has at least one message
-- (a few hundred tiny rows per year), grouped in the caller's time zone.
-- SECURITY INVOKER => normal RLS on public.messages still applies.
CREATE OR REPLACE FUNCTION public.get_message_days(tz text DEFAULT 'UTC')
RETURNS TABLE (day text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT to_char((created_at AT TIME ZONE tz)::date, 'YYYY-MM-DD') AS day
  FROM public.messages
  WHERE created_at IS NOT NULL
  ORDER BY 1 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_message_days(text) TO authenticated;

-- Speeds up the day scan and the paginated history loads.
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages (created_at DESC);

-- Throw away the stale (capped) cached values so they get recomputed correctly.
UPDATE public.user_status SET current_streak = 0, longest_streak = 0, streak_broken_on = NULL;
