
CREATE OR REPLACE FUNCTION public.get_streak_data()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT json_build_object(
      'streak_days', (
        SELECT json_agg(day ORDER BY day DESC) FROM (
          SELECT created_at::date as day
          FROM full_chat_history
          WHERE user_id IS NOT NULL
          GROUP BY day
          HAVING COUNT(*) >= 50 AND COUNT(DISTINCT user_id) >= 2
        ) t
      ),
      'today_count', (
        SELECT COUNT(*)::int
        FROM full_chat_history
        WHERE created_at::date = CURRENT_DATE
          AND user_id IS NOT NULL
      ),
      'today_user_count', (
        SELECT COUNT(DISTINCT user_id)::int
        FROM full_chat_history
        WHERE created_at::date = CURRENT_DATE
          AND user_id IS NOT NULL
      )
    )
  );
END; $function$;
