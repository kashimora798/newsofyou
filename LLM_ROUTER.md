# LLM Router (Phase 0)

Every AI call in NewsOfYou goes through **one** router: `supabase/functions/_shared/llm.ts`.
No edge function talks to a model provider directly (hard rule #6), and no API key ever
reaches the client (hard rule #4).

```
client ──supabase.functions.invoke("ai-*")──► edge function
                                                 │  (inlined copy of the router)
                                                 ▼
                                  _shared/llm.ts ──► provider chain for the task
                                                     (models.ts decides the order)
```

## Files

| File | Role |
|---|---|
| `supabase/functions/_shared/models.ts` | **The only file to edit when a model changes.** Provider table + per-task fallback chains + privacy flags. |
| `supabase/functions/_shared/llm.ts` | Router: routing, privacy tiers, cooldowns, caching, token trimming, usage accounting, auth helpers. |
| `supabase/functions/_shared/safety.ts` | `TWIN_RULES` (build-plan §6) + `quickGuard` / `safetyStop`. |
| `scripts/inline-llm.mjs` | Copies the sources into each function (they deploy standalone). |
| `scripts/test-llm.ts` | 19 offline behaviour tests including the privacy-tier acceptance criteria. |

## Privacy tiers (build-plan §2.2 — non-negotiable)

| Tier | What it is | Providers allowed | Cached? |
|---|---|---|---|
| `private` (**default**) | real chat excerpts, memories, her messages | `noTrain: true` only — Groq, Cerebras, Cloudflare | never |
| `low` | generic text with no personal data (game words, a daily question) | any configured provider | yes, opt-in `ttlSeconds` |

`private` calls also run through `redact()` first: phone numbers, emails and links are
replaced with `[number]` / `[email]` / `[link]` before the text leaves the database.

`noTrain` is a claim we must verify. **Read each provider's current data-use terms**
before trusting it, then flip the flag in `models.ts` — the whole app follows.

## What the router guarantees

| Concern | Behaviour |
|---|---|
| Free only | Every entry in the chains has a free tier. Missing keys are simply skipped. |
| Rate limits | 429 → 60–300 s provider cooldown; 402/401/404 → 1 h; 5xx/504 → 1–2 min. Cooldowns are shared between edge instances via `llm_cooldowns`. |
| Fallback | Failover walks the task's chain (max 4 candidates), retrying once without `response_format` when a model rejects JSON mode. |
| Token conservation | Per-task output clamps, input trimming (oldest dropped, oversized newest truncated), response cache (low only), request coalescing, daily budget `LLM_DAILY_TOKEN_BUDGET` (default 60 000) that degrades output length, then `AiUnavailable` → callers use their non-AI fallback. |
| Observability | One `llm_usage` row per provider/model/task/day with call counts and tokens. **No prompt content is ever stored.** |

## Tasks

Plan tasks: `twin_chat`, `twin_autoreply`, `assist`, `face_to_face`, `greeting`, `summary`, `extract`, `guard`.
App tasks (kept working): `companion`, `chat`, `classify`, `json`, `hint`, `decoy`, `game`, `daily_question`.
Each has temperature / output cap / input budget / timeout / default sensitivity in `TASK_PROFILES`.

## Source of truth vs inlined copies

Functions deploy by name with no bundler step, so real code is copied:

```bash
npm run inline:llm          # after editing llm.ts / models.ts / safety.ts
npm run inline:llm:check    # CI guard — fails when a copy is stale
node scripts/inline-llm.mjs --list
```

Good news for the plan's rule #10: the inliner is **generic**. When Phase 4's `twin-chat`
starts using `quickGuard` / `TWIN_RULES` from `safety.ts`, running `npm run inline:llm`
inserts the safety block into that function automatically — nothing to hand-copy.

Managed today: `ai-chat-summary`, `ai-companion`, `ai-compose-help`, `ai-daily-question`,
`ai-decoy-bot`, `ai-game`, `ai-memory-extract`, `ai-message-guard`, `guess-check`,
`hangman-hint`. (`fetch-link-preview` and `send-scheduled-messages` make no LLM calls.)

## Secrets

```bash
supabase secrets set GROQ_API_KEY=gsk_...        # required for private traffic
supabase secrets set CEREBRAS_API_KEY=csk-...    # optional noTrain fallback
supabase secrets set CF_API_TOKEN=... CF_ACCOUNT_ID=...   # optional noTrain fallback
supabase secrets set GEMINI_API_KEY=...          # optional, low-sensitivity only
supabase secrets set OPENROUTER_API_KEY=sk-or-... # optional, low-sensitivity fallback
```

| Secret | Default | Purpose |
|---|---|---|
| `LLM_ROUTES_JSON` | – | Override model ids without a redeploy: `{"twin_chat":[{"provider":"groq","model":"llama-3.3-70b-versatile"}]}` |
| `LLM_DAILY_TOKEN_BUDGET` | `60000` | Tokens/day across providers before answers degrade |
| `LLM_DISABLED_PROVIDERS` | – | e.g. `gemini,openrouter` |
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
```

Never run a bare `supabase functions deploy` (it tries to deploy `_shared/` and aborts).
Apply `supabase/migrations/20261002120000_llm_router.sql` with `supabase db push`, or paste
it into the SQL editor — it is idempotent and creates `llm_cooldowns`, `llm_cache`,
`llm_usage` plus the `llm_usage_bump` / `llm_cooldown_set` / `llm_prune` RPCs.

## Verify

```bash
npm run check:llm    # inlined copies in sync + 19 offline tests (no deps needed)
```

After deploy, in SQL:

```sql
-- what the router is doing today
select provider, model, task, sum(n) calls, sum(tokens_in + tokens_out) tokens,
       count(*) filter (where not ok) failure_rows
from public.llm_usage where day = (now() at time zone 'utc')::date
group by 1,2,3 order by calls desc;

-- who is cooling down
select provider, until, reason from public.llm_cooldowns order by until desc;
```

## Adding a provider or model

1. Edit `PROVIDERS` / `ROUTES` in `_shared/models.ts` (or override at runtime with `LLM_ROUTES_JSON`).
2. `npm run inline:llm && npm run check:llm`
3. Redeploy the functions whose behaviour changed (all of them, if the pool changed).
