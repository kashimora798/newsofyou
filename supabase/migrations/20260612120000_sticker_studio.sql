-- Sticker Studio: track where a custom sticker came from + an optional emotion tag.
--
-- AI-generated and emoji-mix stickers re-use the existing custom_stickers table
-- (and chat-images bucket). These columns let the picker distinguish/upload-vs-AI
-- and surface emotion tags (e.g. "happy+tear"). Idempotent.

ALTER TABLE public.custom_stickers
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS emotion_tag text;

-- Backfill existing rows to the default explicitly (no-op if already set).
UPDATE public.custom_stickers SET source = 'upload' WHERE source IS NULL;
