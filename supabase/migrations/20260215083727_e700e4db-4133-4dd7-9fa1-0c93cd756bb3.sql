
-- Fix get_chat_stats: replace broken emoji regex with byte-length approach
CREATE OR REPLACE FUNCTION public.get_chat_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
        SELECT ch as emoji, COUNT(*) as count FROM (
          SELECT regexp_split_to_table(content, '') as ch
          FROM full_chat_history WHERE content IS NOT NULL
        ) sub
        WHERE octet_length(ch) >= 4
        GROUP BY ch ORDER BY count DESC LIMIT 10
      ) t
    )
  ) INTO result;
  RETURN result;
END; $function$;

-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  content TEXT,
  send_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  extras JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled messages"
ON public.scheduled_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled messages"
ON public.scheduled_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled messages"
ON public.scheduled_messages FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled messages"
ON public.scheduled_messages FOR UPDATE
USING (auth.uid() = user_id);
