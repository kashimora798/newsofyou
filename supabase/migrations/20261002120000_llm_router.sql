-- Phase 0: shared LLM router support tables.
--
-- Everything here is service-role only: RLS is enabled and there are
-- deliberately NO policies, so neither partner (nor anon) can read it.
-- The router degrades gracefully when these tables are missing, so this
-- migration is safe to apply before or after the functions are deployed.

-- ── 1. Model health / cooldowns ──────────────────────────────────────────
-- Persisted so a 429 seen by one edge instance puts the model on ice for the
-- others too (edge instances are ephemeral).
CREATE TABLE IF NOT EXISTS public.ai_llm_stats (
  provider         text        NOT NULL,
  model            text        NOT NULL,
  ok_count         integer     NOT NULL DEFAULT 0,
  fail_count       integer     NOT NULL DEFAULT 0,
  avg_latency_ms   integer     NOT NULL DEFAULT 0,
  cooldown_until   timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, model)
);

ALTER TABLE public.ai_llm_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_llm_stats FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_llm_stats TO service_role;

-- ── 2. One row per LLM call (no prompt content is ever stored) ────────────
CREATE TABLE IF NOT EXISTS public.ai_llm_events (
  id           bigserial   PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  user_id      uuid,
  tag          text,
  task         text,
  provider     text,
  model        text,
  ok           boolean     NOT NULL DEFAULT false,
  cached       boolean     NOT NULL DEFAULT false,
  degraded     boolean     NOT NULL DEFAULT false,
  attempts     integer     NOT NULL DEFAULT 0,
  tokens_in    integer     NOT NULL DEFAULT 0,
  tokens_out   integer     NOT NULL DEFAULT 0,
  latency_ms   integer     NOT NULL DEFAULT 0,
  trimmed      boolean     NOT NULL DEFAULT false,
  error        text
);

CREATE INDEX IF NOT EXISTS idx_ai_llm_events_created ON public.ai_llm_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_llm_events_user ON public.ai_llm_events (user_id, created_at DESC);

ALTER TABLE public.ai_llm_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_llm_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_llm_events TO service_role;

-- The bigserial sequence only exists if this migration created the table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ai_llm_events_id_seq') THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.ai_llm_events_id_seq TO service_role';
  END IF;
END;
$$;

-- ── 3. Response cache (token conservation) ───────────────────────────────
-- Only ever written for non-personal prompts that opt in (`cacheTtlSeconds`),
-- e.g. daily questions, word validation, hints.
CREATE TABLE IF NOT EXISTS public.ai_llm_cache (
  cache_key    text        PRIMARY KEY,
  task         text        NOT NULL DEFAULT 'chat',
  response     text        NOT NULL,
  provider     text,
  model        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_llm_cache_expires ON public.ai_llm_cache (expires_at);

ALTER TABLE public.ai_llm_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_llm_cache FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_llm_cache TO service_role;

-- ── 4. Per-user daily usage (budget degradation) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id     uuid    NOT NULL,
  day         date    NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  requests    integer NOT NULL DEFAULT 0,
  tokens_in   bigint  NOT NULL DEFAULT 0,
  tokens_out  bigint  NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_daily FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_daily TO service_role;

-- ── 5. Router RPCs ───────────────────────────────────────────────────────

-- Record one attempt and (optionally) cool the model down.
CREATE OR REPLACE FUNCTION public.ai_llm_stat_record(
  p_provider text,
  p_model text,
  p_ok boolean,
  p_latency_ms integer DEFAULT 0,
  p_cooldown_seconds integer DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.ai_llm_stats AS s (provider, model, ok_count, fail_count, avg_latency_ms, cooldown_until, updated_at)
  VALUES (
    p_provider,
    p_model,
    CASE WHEN p_ok THEN 1 ELSE 0 END,
    CASE WHEN p_ok THEN 0 ELSE 1 END,
    GREATEST(p_latency_ms, 0),
    CASE WHEN p_cooldown_seconds > 0 THEN now() + make_interval(secs => p_cooldown_seconds) ELSE NULL END,
    now()
  )
  ON CONFLICT (provider, model) DO UPDATE SET
    ok_count = s.ok_count + CASE WHEN p_ok THEN 1 ELSE 0 END,
    fail_count = s.fail_count + CASE WHEN p_ok THEN 0 ELSE 1 END,
    avg_latency_ms = CASE
      WHEN p_ok AND p_latency_ms > 0 THEN ((s.avg_latency_ms * 7 + p_latency_ms * 3) / 10)
      ELSE s.avg_latency_ms
    END,
    cooldown_until = GREATEST(
      COALESCE(s.cooldown_until, 'epoch'::timestamptz),
      CASE WHEN p_cooldown_seconds > 0 THEN now() + make_interval(secs => p_cooldown_seconds) ELSE 'epoch'::timestamptz END
    ),
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.ai_llm_stat_record(text, text, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_llm_stat_record(text, text, boolean, integer, integer) TO service_role;

-- Accumulate per-user token usage for the current UTC day.
CREATE OR REPLACE FUNCTION public.ai_usage_bump(
  p_user uuid,
  p_in integer,
  p_out integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.ai_usage_daily AS u (user_id, day, requests, tokens_in, tokens_out, updated_at)
  VALUES (p_user, (now() AT TIME ZONE 'utc')::date, 1, GREATEST(p_in, 0), GREATEST(p_out, 0), now())
  ON CONFLICT (user_id, day) DO UPDATE SET
    requests = u.requests + 1,
    tokens_in = u.tokens_in + GREATEST(p_in, 0),
    tokens_out = u.tokens_out + GREATEST(p_out, 0),
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.ai_usage_bump(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_usage_bump(uuid, integer, integer) TO service_role;

-- Housekeeping: drop old events + expired cache entries.
-- Safe to call from a cron job; returns the number of deleted rows.
CREATE OR REPLACE FUNCTION public.ai_llm_prune(p_keep_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer := 0;
  n integer := 0;
BEGIN
  DELETE FROM public.ai_llm_cache WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  deleted := deleted + n;

  DELETE FROM public.ai_llm_events
   WHERE created_at < now() - make_interval(days => GREATEST(p_keep_days, 1));
  GET DIAGNOSTICS n = ROW_COUNT;
  deleted := deleted + n;

  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_llm_prune(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_llm_prune(integer) TO service_role;

-- Optional: schedule nightly housekeeping when pg_cron is available.
-- Guarded so the migration still applies on projects without the extension.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai_llm_prune_daily') THEN
      PERFORM cron.schedule('ai_llm_prune_daily', '17 3 * * *', 'SELECT public.ai_llm_prune(30);');
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;
