
-- Game sessions table
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type text NOT NULL DEFAULT 'tic_tac_toe',
  created_by uuid NOT NULL,
  opponent_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  winner_id uuid,
  board_state jsonb NOT NULL DEFAULT '["","","","","","","","",""]'::jsonb,
  current_turn uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Players can view their own games
CREATE POLICY "Players can view own games"
  ON public.game_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = opponent_id);

-- Authenticated users can create games
CREATE POLICY "Users can create games"
  ON public.game_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Players can update their own games
CREATE POLICY "Players can update own games"
  ON public.game_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = opponent_id);

-- Players can delete their own games
CREATE POLICY "Players can delete own games"
  ON public.game_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = opponent_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
