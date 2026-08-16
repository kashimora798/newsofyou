-- Migration: fix typing_status constraint and add duration to messages
-- 1. Deduplicate any duplicate user_id rows
DELETE FROM public.typing_status a USING public.typing_status b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id;

-- 2. Ensure UNIQUE constraint on typing_status(user_id) for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'typing_status_user_id_key'
  ) THEN
    ALTER TABLE public.typing_status ADD CONSTRAINT typing_status_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 3. Add is_recording column to typing_status
ALTER TABLE public.typing_status ADD COLUMN IF NOT EXISTS is_recording BOOLEAN DEFAULT false;

-- 4. Add duration column to messages for voice note metadata
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS duration INTEGER;
