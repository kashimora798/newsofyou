-- Add handwriting font support to chat_user_settings, user_status, and messages

ALTER TABLE public.chat_user_settings
  ADD COLUMN IF NOT EXISTS use_handwriting_font boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_status
  ADD COLUMN IF NOT EXISTS use_handwriting_font boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS use_handwriting_font boolean DEFAULT NULL;
