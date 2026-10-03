-- Decoy login (build-plan §3.10 privacy work): a *second, entirely fake* login
-- that opens a convincing study app.
--
-- Why it exists: the front page of myanshika.xyz is the romantic door, and the
-- app behind it is unmistakably a couples app. If someone ever takes the phone
-- and demands "open it", there has to be a login that leads to something boring
-- without hinting that anything is hidden.
--
-- Rules this respects:
--   * the decoy credential is NOT real: it can never reach `users`, chat, the
--     twin, or anything else. The study app is generated locally from a fixed
--     dataset plus the display fields below.
--   * only a SHA-256 hash of the decoy password is stored — never the password.
--     The hash is also compared server-side, so no client ever holds it.
--   * the table has RLS on and NO policies: only the service role (the
--     `decoy-login` edge function) and the guarded RPCs below touch it.
--   * `messages` is not touched at all.

-- ── 1. Config (single row) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decoy_login (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  login_id text,                    -- what the (fake) student id looks like
  password_hash text,               -- sha256 hex of the decoy password
  unlock_hash text,                 -- sha256 hex of the code that returns to the real app
  student_name text NOT NULL DEFAULT 'Aarav Sharma',
  grade text NOT NULL DEFAULT 'Class 12 · Science',
  board text NOT NULL DEFAULT 'CBSE',
  school text NOT NULL DEFAULT 'Eduflow Public School',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.decoy_login ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.decoy_login FROM anon, authenticated;
GRANT ALL ON TABLE public.decoy_login TO service_role;
-- (deliberately no policies: nothing on the client may read the hashes)

INSERT INTO public.decoy_login (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 2. Attempt ledger (rate limiting for the decoy door) ─────────────────
CREATE TABLE IF NOT EXISTS public.decoy_login_attempts (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  ip text,
  ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decoy_login_attempts_idx
  ON public.decoy_login_attempts (name, ip, created_at DESC);

ALTER TABLE public.decoy_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.decoy_login_attempts FROM anon, authenticated;
GRANT ALL ON TABLE public.decoy_login_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.decoy_login_attempts_id_seq TO service_role;

-- ── 3. Verify (called by the decoy-login edge function, service role only) ─
-- Hashes are compared here so the plaintext never reaches SQL. Wrong id and
-- wrong password are indistinguishable, and 8 failures per id+IP in 15 minutes
-- locks the door for a while.
CREATE OR REPLACE FUNCTION public.decoy_login_verify(
  p_id text,
  p_hash text,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.decoy_login%ROWTYPE;
  fails int;
BEGIN
  DELETE FROM public.decoy_login_attempts WHERE created_at < now() - interval '7 days';

  SELECT * INTO cfg FROM public.decoy_login WHERE id = 1;
  IF NOT FOUND OR NOT cfg.enabled OR cfg.login_id IS NULL OR cfg.password_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'off');
  END IF;

  SELECT count(*) INTO fails
  FROM public.decoy_login_attempts
  WHERE lower(name) = lower(coalesce(p_id, ''))
    AND (p_ip IS NULL OR ip = p_ip)
    AND ok = false
    AND created_at > now() - interval '15 minutes';

  IF fails >= 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'throttled');
  END IF;

  IF lower(coalesce(p_id, '')) = lower(cfg.login_id)
     AND coalesce(p_hash, '') = cfg.password_hash THEN
    INSERT INTO public.decoy_login_attempts (name, ip, ok)
    VALUES (lower(coalesce(p_id, '')), p_ip, true);
    RETURN jsonb_build_object(
      'ok', true,
      'study', jsonb_build_object(
        'student_name', cfg.student_name,
        'grade', cfg.grade,
        'board', cfg.board,
        'school', cfg.school
      )
    );
  END IF;

  INSERT INTO public.decoy_login_attempts (name, ip, ok)
  VALUES (lower(coalesce(p_id, '')), p_ip, false);
  RETURN jsonb_build_object('ok', false, 'reason', 'credentials');
END;
$$;
REVOKE ALL ON FUNCTION public.decoy_login_verify(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decoy_login_verify(text, text, text) TO service_role;

-- ── 4. Escape hatch: the code that returns to the real app ───────────────
CREATE OR REPLACE FUNCTION public.decoy_login_unlock(p_hash text, p_ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.decoy_login%ROWTYPE;
  fails int;
BEGIN
  SELECT * INTO cfg FROM public.decoy_login WHERE id = 1;
  IF NOT FOUND OR cfg.unlock_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT count(*) INTO fails
  FROM public.decoy_login_attempts
  WHERE ip IS NOT DISTINCT FROM p_ip
    AND ok = false
    AND created_at > now() - interval '15 minutes';

  IF fails >= 12 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'throttled');
  END IF;

  IF coalesce(p_hash, '') = cfg.unlock_hash THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  INSERT INTO public.decoy_login_attempts (name, ip, ok) VALUES ('__unlock__', p_ip, false);
  RETURN jsonb_build_object('ok', false, 'reason', 'code');
END;
$$;
REVOKE ALL ON FUNCTION public.decoy_login_unlock(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decoy_login_unlock(text, text) TO service_role;

-- ── 5. Owner/partner-facing config RPCs (never expose the hashes) ────────
CREATE OR REPLACE FUNCTION public.decoy_login_get()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.decoy_login%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  SELECT * INTO cfg FROM public.decoy_login WHERE id = 1;
  IF NOT FOUND THEN
    RETURN 'null'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'enabled', cfg.enabled,
    'login_id', cfg.login_id,
    'student_name', cfg.student_name,
    'grade', cfg.grade,
    'board', cfg.board,
    'school', cfg.school,
    'has_password', cfg.password_hash IS NOT NULL,
    'has_unlock', cfg.unlock_hash IS NOT NULL,
    'updated_at', cfg.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decoy_login_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decoy_login_get() TO authenticated, service_role;

-- Passing NULL for a hash keeps the existing one, so the screen can be saved
-- without re-typing the password.
CREATE OR REPLACE FUNCTION public.decoy_login_set(
  p_login_id text DEFAULT NULL,
  p_password_hash text DEFAULT NULL,
  p_unlock_hash text DEFAULT NULL,
  p_student_name text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_board text DEFAULT NULL,
  p_school text DEFAULT NULL,
  p_enabled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.decoy_login%ROWTYPE;
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  UPDATE public.decoy_login SET
    enabled = coalesce(p_enabled, enabled),
    login_id = coalesce(nullif(trim(p_login_id), ''), login_id),
    password_hash = coalesce(p_password_hash, password_hash),
    unlock_hash = coalesce(p_unlock_hash, unlock_hash),
    student_name = coalesce(nullif(trim(p_student_name), ''), student_name),
    grade = coalesce(nullif(trim(p_grade), ''), grade),
    board = coalesce(nullif(trim(p_board), ''), board),
    school = coalesce(nullif(trim(p_school), ''), school),
    updated_at = now()
  WHERE id = 1;

  SELECT * INTO cfg FROM public.decoy_login WHERE id = 1;

  RETURN jsonb_build_object(
    'enabled', cfg.enabled,
    'login_id', cfg.login_id,
    'student_name', cfg.student_name,
    'has_password', cfg.password_hash IS NOT NULL,
    'has_unlock', cfg.unlock_hash IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decoy_login_set(text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decoy_login_set(text, text, text, text, text, text, text, boolean) TO authenticated, service_role;

-- Wipe it completely: switch off and delete both hashes.
CREATE OR REPLACE FUNCTION public.decoy_login_clear()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_partner(auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  UPDATE public.decoy_login
     SET enabled = false, login_id = NULL, password_hash = NULL, unlock_hash = NULL, updated_at = now()
   WHERE id = 1;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.decoy_login_clear() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decoy_login_clear() TO authenticated, service_role;
