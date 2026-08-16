-- Migration: user_login_sessions
-- Records device/browser/location info captured on successful login button click.

CREATE TABLE IF NOT EXISTS public.user_login_sessions (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint_id   TEXT,
  ip_address       TEXT,
  country          TEXT,
  city             TEXT,
  region           TEXT,
  latitude         NUMERIC(9, 6),
  longitude        NUMERIC(9, 6),
  browser          TEXT,
  browser_version  TEXT,
  os               TEXT,
  device_type      TEXT,        -- 'mobile' | 'tablet' | 'desktop'
  screen_width     INT,
  screen_height    INT,
  timezone         TEXT,
  language         TEXT,
  user_agent       TEXT,
  logged_in_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_login_sessions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own sessions
CREATE POLICY "Users can insert own login sessions"
  ON public.user_login_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own sessions
CREATE POLICY "Users can read own login sessions"
  ON public.user_login_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX idx_user_login_sessions_user_id
  ON public.user_login_sessions(user_id, logged_in_at DESC);
