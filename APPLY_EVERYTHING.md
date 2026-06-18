# Apply-Everything Runbook

Your live DB and edge functions are **behind the code** — none of the new
migrations or AI functions have been pushed yet. That's the cause of every 404
you saw (`proposals`, `ai-compose-help`, `ai-sticker-suggest`). The `ai-sticker`
400 is a separate generation-API issue (now handled with better errors).

Run these once, in order.

## 1. Apply migrations (creates proposals, ai_memories, decoy, sticker columns, secure RLS)
```bash
supabase db push
```
This applies all 5 unapplied migrations:
- `20260530120000_secure_rls.sql`  (is_partner/is_banned helpers + locked-down RLS)
- `20260530130000_proposals.sql`   (proposals table — now self-contained)
- `20260530140000_ai_memories.sql`
- `20260530150000_decoy_mode.sql`
- `20260612120000_sticker_studio.sql` (custom_stickers.source + emotion_tag)

> The proposals migration now creates `is_partner`/`is_banned` itself if missing,
> so it works even if secure_rls is skipped.

## 2. Set the AI secret (one-time)
```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...
```
The image/video API (`ai-sticker` → https://ahm7xmakki.com/api) needs no key.

## 3. Deploy edge functions — BY NAME (there is no more `_shared`)
The `_shared` folder has been **removed** — every function is now self-contained,
so the slug error can't happen. Deploy each:

```bash
supabase functions deploy ai-compose-help
supabase functions deploy ai-sticker-suggest
supabase functions deploy ai-sticker
supabase functions deploy ai-companion
supabase functions deploy ai-memory-extract
supabase functions deploy ai-message-guard
supabase functions deploy ai-decoy-bot
```

A bare `supabase functions deploy` (no name) now also works since `_shared` is gone,
but deploying by name is safest.

## 4. Verify
```bash
supabase functions list           # all ai-* present
```
- Open the app → proposals load (no 404), ✨ compose-help works, sticker AI works.
