# Love Twin — setup & operations

Phases delivered so far: **0 (LLM router)** and **1 (memory index)**.
Router details live in [`LLM_ROUTER.md`](./LLM_ROUTER.md); this file covers the twin
pipeline: what to apply, what to run, and how to verify.

> The pipeline reads `messages` and **never writes to it** (hard rule #1). Every
> derived table can be rebuilt from `messages` at any time.

```
messages ──rebuild_chat_sessions──► chat_sessions ──rebuild_chat_chunks──► chat_chunks ──┐
   │                                                                                     │ embed-backfill
   └──────────rebuild_reply_pairs──► reply_pairs ────────────────────────────────────────►┘
                                          │
                              build-style-card ──► twin_style_card (editable)
```

## 1. Apply the migration

`supabase/migrations/20261002130000_twin_foundation.sql` (idempotent — safe to re-run):

```bash
supabase db push          # or paste the file into the SQL editor
```

It creates `vector` + `pg_trgm`, `twin_config`, `chat_sessions`, `chat_chunks`,
`reply_pairs`, `twin_style_card`, the free tone classifier, the rebuild + search
functions and the `twin_inspect()` report. Derived tables have RLS on with **no
policies** (service-role only).

## 2. Inspect the real data first (read-only)

The build plan's "first task of every session" — run this and paste the result:

```sql
select jsonb_pretty(public.twin_inspect());
```

It reports: message count + date range, **distinct `message_type` values with counts**,
per-sender counts, rows with blank content, reaction rows, media-only rows, which
extensions exist, and how many chunks/pairs still need embeddings.

If your `message_type` labels differ from the defaults, edit
`public.twin_is_ignored_message(...)` (one line) and re-run the rebuilds — that is the
only place the filter lives.

## 3. Insert the single config row

```sql
insert into public.twin_config (id, owner_user_id, partner_user_id, owner_name, partner_name, partner_nicknames, owner_nicknames)
values (
  1,
  '<his-uuid>',        -- from twin_inspect() -> per_sender
  '<her-uuid>',
  'Kratagya',
  'Ishita',
  array['jaan','babu','shona'],
  array['baby','shona']
)
on conflict (id) do nothing;
```

Leave `twin_enabled = false` and `partner_consented_at = null` — the twin refuses to
answer until she agrees in the Phase 4 consent screen (§7.1 of the plan).

## 4. Build the index

```sql
select public.twin_rebuild_all(false);   -- sessions, chunks, pairs (delta)
select public.twin_rebuild_all(true);    -- full rebuild (safe: derived data only)
```

Then fill in the vectors:

```bash
supabase functions deploy embed-backfill
SUPABASE_URL=https://itjukxjshcobpibmbrzq.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/embed-backfill.mjs
```

`embed-backfill` uses Supabase's built-in `gte-small` (384-dim, free, runs inside the
edge function). It only touches `embedding is null`, so re-running is free. If the
runtime has no `Supabase.ai`, it reports `embedder: "unavailable"` and nothing breaks —
`match_chunks` still returns trigram matches.

> **Backup first** (plan §7.6): before any full rebuild/backfill, take a Supabase backup
> or `pg_dump` of `messages`. The rebuild functions never touch it, but the plan asks for
> the habit.

## 5. Build the style card (one-time, then edit)

```sql
-- needs at least ~30 of his messages and some reply pairs
```
```bash
supabase functions deploy build-style-card
curl -X POST "https://itjukxjshcobpibmbrzq.supabase.co/functions/v1/build-style-card" \
  -H "Authorization: Bearer <owner-access-token>" -H "Content-Type: application/json" -d '{}'
```

It computes the measurements locally (top words, emoji, Hinglish ratio, openers,
closers, pet names, laugh styles, punctuation, dayparts), picks up to 60 real reply
pairs across tones, and makes **one** private LLM call to write a ≤400-word card into
`twin_style_card`. The owner can edit it later (Settings UI lands in a later phase); the
twin always uses the stored version.

## 6. Verify

```sql
-- sanity: counts and date coverage
select (select count(*) from public.chat_sessions) sessions,
       (select count(*) from public.chat_chunks) chunks,
       (select count(*) from public.reply_pairs) pairs,
       (select min(day) from public.chat_sessions) first_day,
       (select max(day) from public.chat_sessions) last_day;

-- sessions that still need vectors
select (select count(*) from public.chat_chunks where embedding is null) chunks_to_embed,
       (select count(*) from public.reply_pairs where embedding is null) pairs_to_embed;

-- tone mix of the real data (tune the lexicon in twin_tone() from this)
select tone, count(*) from public.reply_pairs group by 1 order by 2 desc;

-- delta is idempotent: run twice, numbers must not change
select public.twin_rebuild_all(false);
```

Retrieval spot-checks (replace the vector with one from the table):

```sql
-- "good morning" should return your real morning replies
select partner_text, owner_reply, tone, round(sim::numeric, 3) sim
from public.match_reply_pairs(
  (select embedding from public.reply_pairs where embedding is not null limit 1),
  8, null
);

-- Hinglish query: hybrid (vector + trigram) search
select day, left(transcript, 120) snippet, round(score::numeric, 4) score
from public.match_chunks(
  (select embedding from public.chat_chunks where embedding is not null limit 1),
  'khana kha liya', 6
);
```

## 7. Nightly job (Phase 5 will own this)

`twin_rebuild_all(false)` + the embed loop is the nightly core. Until `twin-nightly`
exists (Phase 5), schedule it from the SQL editor with pg_cron + pg_net, or call it
manually:

```sql
select public.twin_rebuild_all(false);
```

Then run `node scripts/embed-backfill.mjs` (or let Phase 5's `twin-nightly` call the
`embed-backfill` function with the service-role bearer token).

## 8. Deploy reference (by name — rule #10)

```bash
supabase functions deploy embed-backfill
supabase functions deploy build-style-card
# plus everything in LLM_ROUTER.md after a router change
```

Secrets added in Phase 1: **`EMBED_SECRET`** (optional — only needed if you prefer the
`x-embed-secret` header over the service-role bearer token for backfills).

## Cost / quota notes

- Sessions, chunks, pairs and tone classification: **0 LLM calls**.
- Embeddings: free (`gte-small`, inside Supabase).
- Style card: **1 private LLM call**, one time.
- Everything personal stays on `noTrain: true` providers (Groq / Cerebras / Cloudflare).
