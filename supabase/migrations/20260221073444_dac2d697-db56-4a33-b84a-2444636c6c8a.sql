
CREATE OR REPLACE FUNCTION public.get_achievement_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'hours_covered', (
      SELECT json_agg(DISTINCT EXTRACT(HOUR FROM created_at)::int)
      FROM full_chat_history
      WHERE created_at IS NOT NULL
    ),
    'max_word_count_single_msg', (
      SELECT COALESCE(MAX(array_length(regexp_split_to_array(COALESCE(content,''), '\s+'), 1)), 0)
      FROM full_chat_history
      WHERE content IS NOT NULL AND content != ''
    ),
    'total_word_count', (
      SELECT COALESCE(SUM(array_length(regexp_split_to_array(COALESCE(content,''), '\s+'), 1)), 0)
      FROM full_chat_history
      WHERE content IS NOT NULL AND content != ''
    ),
    'max_messages_in_hour', (
      SELECT COALESCE(MAX(cnt), 0) FROM (
        SELECT COUNT(*) as cnt
        FROM full_chat_history
        WHERE created_at IS NOT NULL
        GROUP BY date_trunc('hour', created_at)
      ) sub
    ),
    'letter_count', (
      SELECT COUNT(*) FROM messages WHERE message_type = 'letter'
    ),
    'sorry_count', (
      SELECT COUNT(*) FROM full_chat_history
      WHERE lower(content) LIKE '%sorry%' OR lower(content) LIKE '%i''m sorry%'
    ),
    'fast_reply_count', (
      SELECT COUNT(*) FROM (
        SELECT created_at,
               LAG(created_at) OVER (ORDER BY created_at) as prev_time,
               user_id,
               LAG(user_id) OVER (ORDER BY created_at) as prev_user
        FROM full_chat_history
        WHERE created_at IS NOT NULL AND user_id IS NOT NULL
      ) sub
      WHERE user_id != prev_user
        AND EXTRACT(EPOCH FROM (created_at - prev_time)) <= 2
        AND EXTRACT(EPOCH FROM (created_at - prev_time)) > 0
    ),
    'early_bird_count', (
      SELECT COUNT(*) FROM full_chat_history
      WHERE EXTRACT(HOUR FROM created_at) BETWEEN 5 AND 5
    ),
    'night_owl_3am_count', (
      SELECT COUNT(*) FROM full_chat_history
      WHERE EXTRACT(HOUR FROM created_at) = 3
    ),
    'voice_note_count', (
      SELECT COUNT(*) FROM messages WHERE file_type LIKE 'audio/%'
    ),
    'music_link_count', (
      SELECT COUNT(*) FROM full_chat_history
      WHERE content IS NOT NULL AND (
        lower(content) LIKE '%spotify.com%' OR
        lower(content) LIKE '%music.youtube%' OR
        lower(content) LIKE '%soundcloud.com%' OR
        lower(content) LIKE '%music.apple%'
      )
    )
  ) INTO result;
  RETURN result;
END;
$$;
