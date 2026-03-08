
-- Create daily_checklists table
CREATE TABLE public.daily_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  checklist_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_checklists ENABLE ROW LEVEL SECURITY;

-- Permissive SELECT for all authenticated users
CREATE POLICY "Authenticated users can view all checklists"
  ON public.daily_checklists FOR SELECT TO authenticated
  USING (true);

-- INSERT own items only
CREATE POLICY "Users can insert own checklist items"
  ON public.daily_checklists FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE own items only
CREATE POLICY "Users can update own checklist items"
  ON public.daily_checklists FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- DELETE own items only
CREATE POLICY "Users can delete own checklist items"
  ON public.daily_checklists FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checklists;
