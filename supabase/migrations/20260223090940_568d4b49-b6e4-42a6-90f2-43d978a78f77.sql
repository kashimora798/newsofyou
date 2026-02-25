
-- Table to store per-user achievement and streak state for cross-device sync
CREATE TABLE public.user_achievement_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  -- Streak celebration tracking
  streak_celebrated_date text,
  -- Achievement unlock IDs (for detecting new unlocks)
  unlocked_achievements jsonb DEFAULT '[]'::jsonb,
  -- Secret achievement event flags
  event_jinx boolean DEFAULT false,
  event_1111 boolean DEFAULT false,
  event_newyear boolean DEFAULT false,
  event_timecapsule boolean DEFAULT false,
  event_timetraveler boolean DEFAULT false,
  event_waiter boolean DEFAULT false,
  -- Waiter tracking state
  waiter_open_count int DEFAULT 0,
  waiter_start_time bigint DEFAULT 0,
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_achievement_state ENABLE ROW LEVEL SECURITY;

-- Users can view their own state
CREATE POLICY "Users can view own achievement state"
ON public.user_achievement_state FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own state
CREATE POLICY "Users can insert own achievement state"
ON public.user_achievement_state FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own state
CREATE POLICY "Users can update own achievement state"
ON public.user_achievement_state FOR UPDATE
USING (auth.uid() = user_id);
