
-- Function 1: Get all chat stats in one call
CREATE OR REPLACE FUNCTION public.get_chat_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM full_chat_history),
    'per_user', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT user_id, MAX(username) as name, COUNT(*) as count,
               ROUND(AVG(LENGTH(COALESCE(content,''))))::int as avg_length
        FROM full_chat_history WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) t
    ),
    'by_hour', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as count
        FROM full_chat_history GROUP BY hour ORDER BY count DESC LIMIT 1
      ) t
    ),
    'by_day', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT EXTRACT(DOW FROM created_at)::int as dow, COUNT(*) as count
        FROM full_chat_history GROUP BY dow ORDER BY count DESC LIMIT 1
      ) t
    ),
    'heatmap', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT created_at::date as day, COUNT(*) as count
        FROM full_chat_history GROUP BY day ORDER BY day
      ) t
    ),
    'first_message', (
      SELECT row_to_json(t) FROM (
        SELECT content, username, created_at
        FROM full_chat_history ORDER BY created_at ASC LIMIT 1
      ) t
    ),
    'top_emojis', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT emoji, COUNT(*) as count FROM (
          SELECT regexp_matches(content, '[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F1E0}-\x{1F1FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{1F900}-\x{1F9FF}\x{1FA00}-\x{1FA6F}\x{1FA70}-\x{1FAFF}]', 'g') as emoji_arr
          FROM full_chat_history WHERE content IS NOT NULL
        ) sub, LATERAL unnest(emoji_arr) as emoji
        GROUP BY emoji ORDER BY count DESC LIMIT 10
      ) t
    )
  ) INTO result;
  RETURN result;
END; $$;

-- Function 2: Get streak data (dates where both users were active)
CREATE OR REPLACE FUNCTION public.get_streak_data()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_agg(day ORDER BY day DESC) FROM (
      SELECT created_at::date as day
      FROM full_chat_history
      WHERE user_id IS NOT NULL
      GROUP BY day
      HAVING COUNT(DISTINCT user_id) >= 2
    ) t
  );
END; $$;

-- Function 3: Get "On This Day" memories
CREATE OR REPLACE FUNCTION public.get_on_this_day()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t)) FROM (
      SELECT content, username, created_at
      FROM full_chat_history
      WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(DAY FROM created_at) = EXTRACT(DAY FROM NOW())
        AND EXTRACT(YEAR FROM created_at) < EXTRACT(YEAR FROM NOW())
        AND content IS NOT NULL AND content != ''
      ORDER BY created_at DESC LIMIT 10
    ) t
  );
END; $$;
