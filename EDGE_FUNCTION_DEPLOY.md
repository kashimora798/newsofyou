# Edge Function Deployment — `_shared` slug error fix

## The problem
Running `supabase functions deploy` with **no function name** makes the CLI try
to deploy **every folder** inside `supabase/functions/` — including `_shared/`.
But `_shared` is **not a function**; it's a shared module imported by the others
(`import { callOpenRouter } from "../_shared/openrouter.ts"`). Supabase rejects
it because a function slug cannot start with `_`, and that one failure aborts the
whole batch — which is why "all other errors" cascade and nothing deploys.

## The fix — deploy functions by name (never `_shared`)

Deploy each function explicitly. `_shared` ships automatically because it's
imported — you never deploy it on its own.

```bash
# AI sticker features (new)
supabase functions deploy ai-sticker
supabase functions deploy ai-sticker-suggest

# existing AI functions (if not already deployed)
supabase functions deploy ai-compose-help
supabase functions deploy ai-memory-extract
supabase functions deploy ai-message-guard
supabase functions deploy ai-companion
supabase functions deploy ai-decoy-bot
supabase functions deploy ai-chat-summary
supabase functions deploy ai-daily-question
supabase functions deploy guess-check
supabase functions deploy hangman-hint
supabase functions deploy fetch-link-preview
supabase functions deploy send-scheduled-messages
```

### If you must deploy "all at once"
Newer CLI versions support excluding non-function folders:

```bash
supabase functions deploy --exclude _shared
```

If your CLI doesn't support `--exclude`, just deploy by name as above. Do **not**
run a bare `supabase functions deploy`.

> The `_shared/openrouter.ts` helper is bundled into each function at deploy time
> via its relative import — there is nothing to deploy for `_shared` itself.

## Secrets (one-time)
```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...   # powers ai-sticker-suggest + other text AI
```
The image/video API (`ai-sticker` → `https://ahm7xmakki.com/api`) needs **no key**.

## Migration for this batch
```bash
# adds custom_stickers.source + emotion_tag
supabase db push        # or paste 20260612120000_sticker_studio.sql into the SQL editor
```

## Quick verify
```bash
supabase functions list   # ai-sticker + ai-sticker-suggest should appear, NO _shared
```
