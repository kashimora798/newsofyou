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

## 1b. What your data actually looks like (measured 2026-10-02)

From the first `twin_inspect()` run:

| | |
|---|---|
| Messages | **55,653** (2025-11-21 → 2026-10-02) |
| Types | `text` 52,673 · `gif` 1,651 · `voice_note` 513 · `image` 354 · `touch_reaction` 200 · `sticker` 109 · `secret` 78 · `video` 44 · **`letter` 24** · `bored` 3 · `coinflip` 2 · `rps` 1 · `file` 1 |
| Blank content | 2,954 (2,942 of them media-only) |
| `isReact` rows | 197 |
| Extensions | `vector` 0.8.0, `pg_trgm` 1.6, **`pg_cron` 1.6, `pg_net` 0.14** ✅ (Phase 5 can schedule natively) |
| Distinct senders | **4 user_ids** — `8cd4f48a…` 28,541 · `99d3e44d…` 13,185 · `e40ca809…` 10,395 · `f1fc5a6b…` 3,282 |

Two accounts have changed hands/names over the year, so before configuring:

```sql
-- per account: totals, active window, monthly volumes, display names, 3 recent lines
select user_id, total, first_at, last_at, names, recent_messages
from public.twin_user_report();
```

Read `recent_messages` — that tells you instantly which id is you and which is her.
Then, if extra ids belong to the same two people (old accounts), pass them as the
`*_extra_ids` arrays — the rebuild uses the union of both sides:

```sql
select public.twin_set_config(
  p_owner   => '8cd4f48a-4401-4e3a-8d59-9c7dc2c8b913',   -- him
  p_partner => 'e40ca809-a045-4403-b2bf-cfd570616780',   -- her
  p_owner_name => 'Kratagya',
  p_partner_name => 'Anshika',
  p_partner_nicknames => array['jaan','babu','shona','princess','cutie'],
  p_owner_nicknames   => array['baby','jaanu','sir'],
  p_owner_extra_ids   => '{}',        -- e.g. array['99d3e44d-…']::uuid[]
  p_partner_extra_ids => '{}'         -- e.g. array['f1fc5a6b-…']::uuid[]
);
```

Save it, then run the rebuild:

```sql
select public.rebuild_chat_sessions(interval '3 hours', true);   -- sessions
select public.rebuild_chat_chunks(true);                         -- chunks
select public.rebuild_reply_pairs(true);                         -- pairs + tone
-- or all three at once:
select public.twin_rebuild_all(true);
```

**Filter note:** the `text` corpus keeps `letter`, `secret` and media *captions*
(they carry words). Only mechanical rows (`touch_reaction`, `coinflip`, `rps`, `bored`,
reactions, system) and placeholder captions like `[Voice note]` are ignored —
`twin_is_ignored_message()` and `twin_is_placeholder_content()` are the only places
to change that.

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

## 7b. Phase 2 — the spell door and the greeting bank

Apply the second migration, then seed the bank:

```bash
supabase db push                     # adds 20261003090000_ and 20261004090000_
supabase functions deploy spell-login
supabase functions deploy twin-greet
supabase functions deploy seed-greetings

# one owner access token (Dashboard → Authentication → your user → access token)
export SUPABASE_URL="https://itjukxjshcobpibmbrzq.supabase.co"
export OWNER_ACCESS_TOKEN="eyJ..."     # never committed
node scripts/seed-greetings.mjs --dry-run
node scripts/seed-greetings.mjs        # ~300 lines, 9 free LLM calls
```

What to expect, in order:

1. `/you/login` shows two name cards (labels only, from `twin_login_cards()`).
   `?classic=1` still reaches the old email/password form if anything goes wrong.
2. After she taps **I'm okay with it** once (`twin_record_consent()`), Home shows a
   handwritten greeting: live AI at most once a day and never twice within 6 hours,
   otherwise a pre-written line from the bank — so opening the app 50× costs 0 calls.
3. Revoking (Settings → AI Twin → off, or via the greeting sheet) sets
   `twin_enabled = false` and deletes what it had learned about her.
4. The owner screen at `/you/twin` edits the bank, rebuilds it, and shows the voice
   profile. Only the owner reaches it (`twin_is_owner()`); she is redirected home.

Rate limits on the door: 5 wrong spells per name+IP per 15 minutes, then the stars dim
for a minute (`{ error: "dimmed", retry_after }`). Wrong name and wrong spell return the
same answer, so the door never confirms who exists.

## 7c. The front page (decoy school portal)

`myanshika.xyz/` now serves a **school portal sign-in** (`Eduflow Public School`,
PT DP Mishra Memorial). Behind the decoy credential sits a fake student portal
(`/study`): timetable, assignments, notes, results, attendance, fees, notices and
a locally-answered "doubt solver". None of it touches the real database — the
dataset is invented in `src/lib/studyData.ts` and the login only verifies a hash.

Apply and configure:

```sql
-- after supabase db push (adds 20261005090000_decoy_login.sql)
-- 1. one-time, straight in the SQL editor (sha256 of 'your-fake-password'):
select public.decoy_login_set(
  p_login_id      => '12S-27',
  p_password_hash => encode(digest('your-fake-password', 'sha256'), 'hex'),
  p_unlock_hash   => encode(digest('your-exam-code', 'sha256'), 'hex'),
  p_student_name  => 'Aarav Sharma',
  p_grade         => 'Class 12 · Science',
  p_enabled       => true
);
```

…or just use **Settings → Privacy → Front page decoy login** (it hashes for you).

```bash
supabase functions deploy decoy-login
```

How it behaves:

- `/` → the school portal. Wrong ID or password answers exactly like an unknown
  school ID; 8 failures per ID+IP in 15 minutes locks the form for a while.
- Correct ID + password → `/study`, the fake student portal (session lives in
  `sessionStorage`, expires with the tab).
- Inside the portal, **Exam cell → Enter verification code** accepts the exam code
  and takes you back to the real door. No site data needs clearing.
- `/real` is the real door (the front page links it as "Faculty & alumni");
  `/you/login` still works, `?classic=1` still reaches the old email/password form.
- A real signed-in session on the same device shows a small "Signed in · continue"
  chip on the front page, so you are never locked out of your own app.

**Update `verify_jwt`?** No. The anon key that ships in the client is a valid
Supabase JWT, so the default `verify_jwt = true` lets anonymous visitors through
while still keeping the function authenticated at the platform level.

## 8. Deploy reference (by name — rule #10)

```bash
supabase functions deploy embed-backfill
supabase functions deploy build-style-card
supabase functions deploy spell-login
supabase functions deploy twin-greet
supabase functions deploy seed-greetings
supabase functions deploy decoy-login
# plus everything in LLM_ROUTER.md after a router change
```

Secrets added in Phase 1: **`EMBED_SECRET`** (optional — only needed if you prefer the
`x-embed-secret` header over the service-role bearer token for backfills).

## Cost / quota notes

- Sessions, chunks, pairs and tone classification: **0 LLM calls**.
- Embeddings: free (`gte-small`, inside Supabase).
- Style card: **1 private LLM call**, one time.
- Greeting bank: **9 private LLM calls**, one time (then editable by hand).
- Every greeting she sees: **0 LLM calls** on the normal path; the twin spends at most
  `twin_config.greeting_live_per_day` (default 1) live calls per day, ≥6 h apart.
- Everything personal stays on `noTrain: true` providers (Groq / Cerebras / Cloudflare).
