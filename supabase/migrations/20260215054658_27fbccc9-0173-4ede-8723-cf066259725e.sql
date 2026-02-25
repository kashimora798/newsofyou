
-- Add new columns to messages table for file sharing, GIF, sticker support
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS gif_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sticker_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
