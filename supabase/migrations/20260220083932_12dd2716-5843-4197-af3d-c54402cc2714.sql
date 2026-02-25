
-- Feature 2: Invisible Ink - add revealed column
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS revealed boolean DEFAULT false;

-- Allow users to update the revealed column on messages they received
CREATE POLICY "Users can reveal secret messages" 
ON public.messages 
FOR UPDATE 
USING (user_id != auth.uid())
WITH CHECK (user_id != auth.uid());

-- Feature 4: Enhanced Presence - add custom_status and activity_state
ALTER TABLE public.user_status ADD COLUMN IF NOT EXISTS custom_status text DEFAULT null;
ALTER TABLE public.user_status ADD COLUMN IF NOT EXISTS activity_state text DEFAULT 'offline';

-- Feature 6: Advanced Stats RPC
CREATE OR REPLACE FUNCTION public.get_advanced_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'monthly', (
      SELECT json_agg(row_to_json(t) ORDER BY t.month) FROM (
        SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count
        FROM full_chat_history
        WHERE created_at IS NOT NULL
        GROUP BY month ORDER BY month
      ) t
    ),
    'hourly_per_user', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT user_id, MAX(username) as name, EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as count
        FROM full_chat_history
        WHERE user_id IS NOT NULL
        GROUP BY user_id, hour ORDER BY hour
      ) t
    ),
    'top_words', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT word, COUNT(*) as count FROM (
          SELECT lower(regexp_split_to_table(content, '\s+')) as word
          FROM full_chat_history
          WHERE content IS NOT NULL AND length(content) > 0
        ) sub
        WHERE length(word) > 3
          AND word NOT IN ('the','and','that','this','with','have','from','they','been','will','would','could','should','about','their','there','which','what','when','where','your','just','like','know','than','them','then','some','time','very','much','more','also','into','over','such','after','only','other','these','back','well','come','made','make','take','want','give','most','even','here','think','does','didn','it''s','i''m','don''t','can''t','won''t')
        GROUP BY word
        ORDER BY count DESC LIMIT 30
      ) t
    ),
    'records', (
      SELECT json_build_object(
        'max_messages_day', (
          SELECT json_build_object('day', day, 'count', cnt) FROM (
            SELECT created_at::date as day, COUNT(*) as cnt
            FROM full_chat_history GROUP BY day ORDER BY cnt DESC LIMIT 1
          ) t
        ),
        'longest_message', (
          SELECT json_build_object('length', len, 'username', username, 'created_at', created_at) FROM (
            SELECT length(content) as len, username, created_at
            FROM full_chat_history WHERE content IS NOT NULL
            ORDER BY len DESC LIMIT 1
          ) t
        )
      )
    ),
    'keyword_counts', (
      SELECT json_build_object(
        'love', (SELECT COUNT(*) FROM full_chat_history WHERE lower(content) LIKE '%i love you%'),
        'hug', (SELECT COUNT(*) FROM full_chat_history WHERE lower(content) LIKE '%hug%'),
        'lol', (SELECT COUNT(*) FROM full_chat_history WHERE lower(content) ~ '(lol|haha|😂|🤣)'),
        'miss', (SELECT COUNT(*) FROM full_chat_history WHERE lower(content) LIKE '%miss you%'),
        'good_morning', (SELECT COUNT(*) FROM full_chat_history WHERE lower(content) LIKE '%good morning%'),
        'good_night', (SELECT COUNT(*) FROM full_chat_history WHERE lower(content) LIKE '%good night%')
      )
    ),
    'photos_count', (SELECT COUNT(*) FROM messages WHERE image_url IS NOT NULL AND image_url != ''),
    'night_owl_count', (SELECT COUNT(*) FROM full_chat_history WHERE EXTRACT(HOUR FROM created_at) BETWEEN 2 AND 4)
  ) INTO result;
  RETURN result;
END;
$function$;
