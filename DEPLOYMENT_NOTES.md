# Deployment & verification — Gen-Z chat upgrade

All code is implemented and type-checks clean (`npx tsc`). The following steps must
be done **on your Supabase project** to activate the database + AI changes — they
can't be done from app code.

## 1. Apply the new migrations (in order)

```
supabase/migrations/20260530120000_secure_rls.sql      # Phase 1 — locks down messages RLS, bans, limits
supabase/migrations/20260530130000_proposals.sql        # Phase 3 — proposals table
supabase/migrations/20260530140000_ai_memories.sql      # Phase 5 — ai_memories table
supabase/migrations/20260530150000_decoy_mode.sql       # Phase 7 — decoy columns
```

Run `supabase db push` (CLI) or paste each file into the Supabase SQL editor in order.

> ⚠️ **Phase 1 is the important security fix.** Before it, any logged-in account
> could read/edit the entire private chat. After it, only `partner`/`admin` users
> who aren't banned can. Verify (below) right after applying.

## 2. Add the OpenRouter secret

```
supabase secrets set OPENROUTER_API_KEY=sk-or-...
```
Free models are used by default with automatic fallback on rate-limit.

## 3. Deploy the new edge functions

```
supabase functions deploy ai-compose-help
supabase functions deploy ai-memory-extract
supabase functions deploy ai-message-guard
supabase functions deploy ai-companion
supabase functions deploy ai-decoy-bot
```
They share `supabase/functions/_shared/openrouter.ts`.

## 4. Regenerate types (optional)

New tables/columns are accessed via `(supabase as any)` casts, so the app compiles
without this. For full typing:
```
supabase gen types typescript --project-id itjukxjshcobpibmbrzq > src/integrations/supabase/types.ts
```

---

## Verification checklist

**Security (Phase 1)** — log in as each partner:
- Both partners still see each other's messages; seen/delivered still update; realtime still live.
- As a non-partner / anon role, `select * from messages` returns 0 rows.
- Trigger a 5-min ban; confirm the banned user's `select`/`insert` on messages is rejected by the DB.

**Performance (Phase 2):**
- DevTools → Network: steady 3s/5s/10s polling requests are gone; messages still instant.
- Long history scrolls smoothly (content-visibility skips offscreen bubbles).
- Settings → Calm Mode pauses petals/sparkles/sky/theme animations.

**Proposals (Phase 3):**
- "+" → Pact → "Talk for 30 min" → partner sees the live accept/decline banner → accept → countdown in banner → soft "time's up" overlay at 0.
- `reminder` type creates a reminder for both; `date` adds a shared calendar event.

**AI (Phases 4–6):** require steps 2–3 above.
- ✨ button in the input rewrites a draft (compose help).
- Long-press a message → "Teach AI" saves a memory; "Ask companion" shows a praise/console card.

**Decoy (Phase 7):**
- Settings → Quick Hide → enable, pick ChatGPT/Gemini/Claude, set an unlock code.
- The mask button appears in the chat header → tap it → disguised AI app with working bot + seeded history; real messages hidden; refresh stays disguised.
- Type the unlock code into the disguised app's box → returns to the real chat. Wrong code just chats with the decoy bot.

---

## Notes / caveats
- **Decoy mode is a shoulder-surfing disguise, not encryption.** Someone with the
  unlocked device or a valid login can still reach the data (documented in the Settings copy too).
- **AI sends message text to OpenRouter.** It's opt-in (buttons/long-press), keeping
  it off the hot path and within free-tier limits.
- Free OpenRouter models can change/deprecate; the shared helper tries several and
  handles 429/402 gracefully.
