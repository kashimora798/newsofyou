
-- Add new columns to chat_user_settings
ALTER TABLE public.chat_user_settings 
ADD COLUMN IF NOT EXISTS dynamic_wallpaper boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS message_effects boolean NOT NULL DEFAULT true;
