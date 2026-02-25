
-- 1. Update custom_stickers SELECT RLS to allow both partners to see all stickers
DROP POLICY IF EXISTS "Users can view their own stickers" ON public.custom_stickers;
CREATE POLICY "Authenticated users can view all stickers"
  ON public.custom_stickers FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Create pending_animations table for queued offline animations
CREATE TABLE public.pending_animations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id uuid NOT NULL,
  animation_type text NOT NULL,
  animation_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sender_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_animations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending animations"
  ON public.pending_animations FOR SELECT
  USING (auth.uid() = target_user_id);

CREATE POLICY "Authenticated users can insert pending animations"
  ON public.pending_animations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own pending animations"
  ON public.pending_animations FOR DELETE
  USING (auth.uid() = target_user_id);
