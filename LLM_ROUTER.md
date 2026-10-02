# LLM Router (Phase 0)

Every AI call in NewsOfYou goes through **one** router: `supabase/functions/_shared/llm.ts`.
No edge function talks to a model provider directly, and no API key ever reaches the client.

```
client ──supabase.functions.invoke("ai-*")──► edge function
                                                 │  (inlined copy of the router)
                                                 ▼
                                        _shared/llm.ts  ──► OpenRouter  (free models, primary)
                                                        ──► Groq      (free tier, fast)
                                                        ──► Gemini    (AI Studio free tier)
                                                        ──► Cerebras  (free tier)
                                                        ──► Lovable   (legacy gateway, optional)
```

## What the router guarantees

| Concern | Behaviour |
|---|---|
| Free only | Every provider/model in the pool has a free tier. Nothing breaks if you only set `OPENROUTER_API_KEY`. |
| Rate limits | 429/402/404/5xx/timeout/empty → next model. Cooling is exponential (60s → 300s, 402 → 15 min per provider) and shared across edge instances via `ai_llm_stats`. |
| Self-routing | Candidates are scored by measured success rate + latency EMA, and tasks pick a tier (fast vs strong). `LLM_PREFER_PROVIDER` biases the order. |
| Token conservation | Per-task output caps, input trimming (oldest messages dropped, oversized newest truncated), request coalescing, opt-in response cache, per-user daily budget that **degrades** (cheap tier + shorter outputs) instead of failing. |
| Observability | One row per call in `ai_llm_events` (model, provider, tokens, latency, error). **No prompt content is ever stored.** |
| Privacy | Personal prompts (`personal: true`) are never cached. Chat logs are sent to the model but only counted in the DB. |

## Source of truth vs inlined copies

Functions deploy by name and have no bundler step, so the block between
`// ── BEGIN GENERATED BLOCK ──` and `// ── END GENERATED BLOCK ──` is copied into each
function that needs it.

```bash
npm run inline:llm          # regenerate every copy after editing _shared/llm.ts
npm run inline:llm:check    # CI guard: fails if a copy is stale
npm run inline:llm -- --list
```

Never hand-edit a generated block. Managed today: `ai-chat-summary`, `ai-companion`,
`ai-compose-help`, `ai-daily-question`, `ai-decoy-bot`, `ai-game`, `ai-memory-extract`,
`ai-message-guard`, `guess-check`, `hangman-hint`.
(`fetch-link-preview` and `send-scheduled-messages` make no LLM calls and are skipped.)

## Secrets

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...     # required (free models)
supabase secrets set GROQ_API_KEY=gsk_...             # optional fallback
supabase secrets set GEMINI_API_KEY=...               # optional fallback
supabase secrets set CEREBRAS_API_KEY=csk-...         # optional fallback
supabase secrets set LOVABLE_API_KEY=...              # optional legacy fallback
```

Optional tunables (no redeploy of code needed, just re-set the secret):

| Secret | Default | Purpose |
|---|---|---|
| `LLM_DAILY_TOKEN_BUDGET` | `20000` | Soft per-user daily token ceiling before degradation |
| `LLM_DISABLED_PROVIDERS` | – | e.g. `groq,cerebras` |
| `LLM_PREFER_PROVIDER` | – | e.g. `groq` (still falls back) |
| `LLM_POOL_FAST` / `LLM_POOL_STRONG` | – | csv of `provider:model` prepended to the pools |
| `AI_REQUIRE_AUTH` | `true` | `false` lets anonymous callers use game helpers |

## Deploy

```bash
supabase functions deploy ai-chat-summary
supabase functions deploy ai-companion
supabase functions deploy ai-compose-help
supabase functions deploy ai-daily-question
supabase functions deploy ai-decoy-bot
supabase functions deploy ai-game
supabase functions deploy ai-memory-extract
supabase functions deploy ai-message-guard
supabase functions deploy guess-check
supabase functions deploy hangman-hint
# fetch-link-preview + send-scheduled-messages: unchanged in Phase 0
```

Never run a bare `supabase functions deploy` (it tries to deploy `_shared/` and aborts).
Apply `supabase/migrations/20261002120000_llm_router.sql` through your normal flow
(`supabase db push`, or paste it into the SQL editor — it is idempotent).

## Verify

```bash
npm run check:llm    # inlined copies in sync + 11 router behaviour tests (no deps needed)
```

Then, after deploy:

```sql
-- what the router is doing (last 24h)
select provider, model, count(*) calls, round(avg(latency_ms)) avg_ms,
       sum(tokens_in + tokens_out) tokens, count(*) filter (where not ok) failures
from public.ai_llm_events
where created_at > now() - interval '24 hours'
group by 1, 2 order by calls desc;

-- who is close to their daily budget
select user_id, tokens_in + tokens_out as used from public.ai_usage_daily
where day = (now() at time zone 'utc')::date order by used desc;
```

## Adding a provider or model

1. Add/extend the entry in `PROVIDERS` (env key, OpenAI-compatible URL, `fast`/`strong` lists)
   inside `_shared/llm.ts`, or override at runtime with `LLM_POOL_FAST` / `LLM_POOL_STRONG`.
2. `npm run inline:llm && npm run check:llm`
3. Redeploy the functions whose behaviour you changed (all of them, if the pool changed).
