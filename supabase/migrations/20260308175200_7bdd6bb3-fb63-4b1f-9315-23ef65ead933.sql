
-- Add event_midnightgamer to user_achievement_state
ALTER TABLE public.user_achievement_state ADD COLUMN IF NOT EXISTS event_midnightgamer boolean DEFAULT false;

-- Update get_achievement_stats to include new counts
CREATE OR REPLACE FUNCTION public.get_achievement_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    ),
    -- New stats for 12 new achievements
    'bookmark_count', (
      SELECT COUNT(*) FROM bookmarks WHERE user_id = auth.uid()
    ),
    'reaction_count', (
      SELECT COUNT(*) FROM message_reactions WHERE user_id = auth.uid()
    ),
    'gif_count', (
      SELECT COUNT(*) FROM messages WHERE gif_url IS NOT NULL AND gif_url != ''
    ),
    'sticker_count', (
      SELECT COUNT(*) FROM messages WHERE sticker_url IS NOT NULL AND sticker_url != ''
    ),
    'compliment_count', (
      SELECT COUNT(*) FROM compliments
    ),
    'reminder_count', (
      SELECT COUNT(*) FROM reminders
    ),
    'event_count', (
      SELECT COUNT(*) FROM shared_events
    ),
    'scheduled_count', (
      SELECT COUNT(*) FROM scheduled_messages WHERE user_id = auth.uid()
    ),
    'game_completed_count', (
      SELECT COUNT(*) FROM game_sessions WHERE status = 'completed'
        AND (created_by = auth.uid() OR opponent_id = auth.uid())
    ),
    'checklist_perfect_streak', (
      SELECT COALESCE(MAX(streak), 0) FROM (
        SELECT COUNT(*) as streak FROM (
          SELECT d.checklist_date,
                 d.checklist_date::date - (ROW_NUMBER() OVER (ORDER BY d.checklist_date))::int * INTERVAL '1 day' as grp
          FROM (
            SELECT DISTINCT checklist_date
            FROM daily_checklists
            WHERE is_completed = true
            GROUP BY checklist_date
            HAVING COUNT(*) = (SELECT COUNT(*) FROM daily_checklists dc2 WHERE dc2.checklist_date = daily_checklists.checklist_date)
              AND COUNT(*) FILTER (WHERE is_completed = false) = 0
          ) d
        ) grouped
        GROUP BY grp
      ) streaks
    )
  ) INTO result;
  RETURN result;
END;
$function$;
