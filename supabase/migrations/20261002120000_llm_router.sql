-- Phase 0: shared LLM router support (build-plan §Phase 0).
--
-- Service-role only: RLS is enabled and there are deliberately NO policies, so
-- neither partner (nor anon) can read any of this. The router degrades
-- gracefully when these tables are missing, so this migration is safe to apply
-- before or after the functions are deployed.
--
--   llm_cooldowns  provider -> until (a 429/5xx puts a provider on ice for all
--                  edge instances, which are otherwise stateless)
--   llm_cache      response cache, LOW-sensitivity prompts only (never cache
--                  anything personal — the router refuses by design)
--   llm_usage      daily provider counter (day, provider, model, task, ok)

-- ── 1. Provider cooldowns ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.llm_cooldowns (
  provider    text        PRIMARY KEY,
  until       timestamptz NOT NULL,
  reason      text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.llm_cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.llm_cooldowns FROM anon, authenticated;
GRANT ALL ON TABLE public.llm_cooldowns TO service_role;

-- ── 2. Response cache (token conservation) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.llm_cache (
  key         text        PRIMARY KEY,
  value       text        NOT NULL,
  provider    text,
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON public.llm_cache (expires_at);

ALTER TABLE public.llm_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.llm_cache FROM anon, authenticated;
GRANT ALL ON TABLE public.llm_cache TO service_role;

-- ── 3. Daily usage per provider/model/task (no prompt content) ───────────
CREATE TABLE IF NOT EXISTS public.llm_usage (
  day         date    NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  provider    text    NOT NULL,
  model       text    NOT NULL,
  task        text    NOT NULL,
  ok          boolean NOT NULL DEFAULT true,
  n           integer NOT NULL DEFAULT 0,   -- number of calls
  tokens_in   bigint  NOT NULL DEFAULT 0,
  tokens_out  bigint  NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, provider, model, task, ok)
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_day ON public.llm_usage (day DESC);

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.llm_usage FROM anon, authenticated;
GRANT ALL ON TABLE public.llm_usage TO service_role;

-- ── 4. Router RPCs ───────────────────────────────────────────────────────

-- Upsert one call into the daily counter.
CREATE OR REPLACE FUNCTION public.llm_usage_bump(
  p_day date,
  p_provider text,
  p_model text,
  p_task text,
  p_ok boolean,
  p_tokens_in integer DEFAULT 0,
  p_tokens_out integer DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.llm_usage AS u (day, provider, model, task, ok, n, tokens_in, tokens_out, updated_at)
  VALUES (
    COALESCE(p_day, (now() AT TIME ZONE 'utc')::date),
    p_provider, p_model, p_task, COALESCE(p_ok, true), 1,
    GREATEST(COALESCE(p_tokens_in, 0), 0), GREATEST(COALESCE(p_tokens_out, 0), 0),
    now()
  )
  ON CONFLICT (day, provider, model, task, ok) DO UPDATE SET
    n = u.n + 1,
    tokens_in = u.tokens_in + GREATEST(COALESCE(p_tokens_in, 0), 0),
    tokens_out = u.tokens_out + GREATEST(COALESCE(p_tokens_out, 0), 0),
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.llm_usage_bump(date, text, text, text, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.llm_usage_bump(date, text, text, text, boolean, integer, integer) TO service_role;

-- Put a provider on ice (429 / 5xx), readable by every edge instance.
CREATE OR REPLACE FUNCTION public.llm_cooldown_set(
  p_provider text,
  p_until timestamptz,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.llm_cooldowns AS c (provider, until, reason, updated_at)
  VALUES (p_provider, p_until, p_reason, now())
  ON CONFLICT (provider) DO UPDATE SET
    until = GREATEST(c.until, EXCLUDED.until),
    reason = COALESCE(EXCLUDED.reason, c.reason),
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.llm_cooldown_set(text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.llm_cooldown_set(text, timestamptz, text) TO service_role;

-- Housekeeping: expired cache entries + stale cooldowns + old usage rows.
CREATE OR REPLACE FUNCTION public.llm_prune(p_keep_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer := 0;
  n integer := 0;
BEGIN
  DELETE FROM public.llm_cache WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  deleted := deleted + n;

  DELETE FROM public.llm_cooldowns WHERE until < now() - interval '1 hour';
  GET DIAGNOSTICS n = ROW_COUNT;
  deleted := deleted + n;

  DELETE FROM public.llm_usage WHERE day < (now() AT TIME ZONE 'utc')::date - GREATEST(p_keep_days, 1);
  GET DIAGNOSTICS n = ROW_COUNT;
  deleted := deleted + n;

  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.llm_prune(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.llm_prune(integer) TO service_role;

-- Optional nightly housekeeping when pg_cron is available (Phase 5 will reuse
-- this pattern for twin-nightly).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'llm_prune_daily') THEN
      PERFORM cron.schedule('llm_prune_daily', '17 3 * * *', 'SELECT public.llm_prune(90);');
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;
