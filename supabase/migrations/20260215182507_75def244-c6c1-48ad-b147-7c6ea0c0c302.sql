
-- Custom Stickers table
CREATE TABLE public.custom_stickers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sticker_url text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stickers"
  ON public.custom_stickers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stickers"
  ON public.custom_stickers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stickers"
  ON public.custom_stickers FOR DELETE
  USING (auth.uid() = user_id);

-- Custom Touch Reactions table
CREATE TABLE public.custom_touch_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL,
  verb text NOT NULL,
  emoji text,
  particles text[],
  particle_size integer NOT NULL DEFAULT 30,
  gradient text,
  vibration_strength text NOT NULL DEFAULT 'medium',
  vibration_duration integer NOT NULL DEFAULT 1000,
  shake boolean NOT NULL DEFAULT false,
  flash boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_touch_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all custom reactions"
  ON public.custom_touch_reactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own custom reactions"
  ON public.custom_touch_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom reactions"
  ON public.custom_touch_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom reactions"
  ON public.custom_touch_reactions FOR DELETE
  USING (auth.uid() = user_id);
