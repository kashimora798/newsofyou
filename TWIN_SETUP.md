# Love Twin — setup & operations

> **Start with [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md)** — it is the
> single, ordered runbook (what to run in the database, in what order, and why).
> This file keeps the twin's pipeline detail.


Phases delivered so far: **0 (LLM router) · 1 (memory index) · 2 (spell door +
greetings) · 3 (Home scene) · 6 (the Book) · 4 (twin chat + away-reply) ·
5 (memory 2.0) · 7 (assistant actions) · 9a (media compression)**.
Phase 8 (Face to Face) and the rest of 9 are next.
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

## 7d. Phase 6 — the Book

One page per day they actually talked. Browsing is **free forever**: opening a
day composes a page from their own lines (heuristics, no AI) and stores it.
Only the explicit "ask the twin to write this day properly" tap spends one
`book` task call (private tier), and that result is kept — one call per day,
ever. Both partners can add one handwritten margin note and mark a day to keep.

```bash
supabase db push                          # adds 20261006090000_twin_book.sql
supabase functions deploy book-page
```

What the database gives you:

- `book_config` — title, subtitle, dedication, cover style, and `hide_private`
  (skips `secret`-type messages on pages).
- `book_pages` — title, subtitle, mood, the curated `excerpt` (their real lines,
  in order, with who said what), photo, day stats, note, favourite,
  `generated_by` (heuristic|llm), model + tokens.
- `book_days(...)` — the table of contents (a day + whether it has a page),
  callable by either partner.
- `book_day_material(day)` — the raw material for composing one day (service
  role only; the edge function fetches it with its own scoped client).
- `book_page_upsert(...)` — never downgrades a page a person or the twin wrote
  unless forced.
- `book_page_note()` / `book_page_favorite()` — guarded, either of them.
- `book_stats()` — the cover numbers.

Routes: `/book` (cover + contents) and `/book/:date` (a spread). The cover
refuses to claim credit for AI work: an LLM-written page says so, quietly.

## 7e. Phase 4 — the twin's chat, and the away-reply

Two surfaces, one brain (`twin-reply`):

1. **`/twin` — her private chat with the twin.** She opens a thread (private to
   her at birth), writes whatever she wants, and the twin answers in his voice —
   labelled as an AI on every bubble. Retrieval feeds it his real replies
   (`match_reply_pairs`, tone-biased) plus a handful of consented memories, so it
   sounds like him without inventing things. Nothing is written to the couple's
   real `messages` table: her thread lives in `twin_conversations` /
   `twin_messages`. Sharing one thread with him is a per-thread toggle; the
   default is private.
2. **The away-reply in `/chat`.** When he has been offline past
   `auto_reply_after_minutes`, her last message has no answer, and the daily /
   gap budgets allow it, the twin writes ONE short note and it appears in the
   chat as an AI-labelled line (`twin_auto_replies`), with "written by his AI,
   not by him" underneath. He sees it, can dismiss it, and can run the same path
   by hand from `/you/twin`.

```bash
supabase db push                          # adds 20261007090000_twin_chat.sql
supabase functions deploy twin-reply      # both paths live in this one function
```

What the database gives you:

- `twin_conversations` / `twin_messages` — her threads and the twin's replies
  (mood, proposed `actions`, model, tokens, `guarded`). RLS: her rows only; a
  `shared` thread is readable by both partners.
- `twin_auto_replies` — the notes written in his place: `standing` until he
  follows up (then `superseded`) or dismisses it (`dismissed`). Deliberately
  **outside** `messages` (hard rule #1).
- `twin_autoreply_state(...)` — the single auditable place the away-reply is
  decided: consent, switch, he-must-really-be-offline, the wait, unanswered,
  `auto_reply_max_per_day`, `auto_reply_min_gap_minutes`. The edge function only
  *asks*; this function *decides*.
- `twin_message_append(...)` — the only writer for both sides; a signed-in
  account can only write her own words, the service role writes the twin's.
- `twin_set_automation(...)` — owner-only switches and numbers
  (`auto_reply_enabled`, `twin_chat_enabled`, wait / max / gap).
- `twin_chat_stats()` / `twin_autoreply_for_chat()` / `twin_autoreply_ack()` /
  `twin_autoreply_dismiss()` — what the two UIs read and write.

Consent first: nothing answers until she has agreed (`partner_consented_at`) and
`twin_enabled` is on; her chat also needs `twin_chat_enabled` (or she is the
owner, testing). If all providers are rate-limited, the twin stays quiet rather
than sending something off-voice — the fallback line is only used when the model
answered and the safety guard tripped twice.

Cost:

- An away-reply is **1 `twin_autoreply` call**, at most 3/day (default) with a
  45-minute gap; the eligibility check itself is free SQL, so the client can ask
  often without spending anything.
- One twin-chat turn is **1 `twin_chat` call** (private tier only). It retries
  once *only* if the safety guard trips.
- Embeddings for retrieval are free (`gte-small`); if the embedder is
  unavailable the twin answers with no examples instead of failing.

Routes: `/twin` (her chat). The control room at `/you/twin` gained the switches,
the wait / max / gap numbers, "answer her now", and the list of recent
away-replies.

## 7f. Phase 5 — memory 2.0

The twin used to "remember" through one greedy model call that read 80 messages
every time you tapped the button. Phase 5 splits that in two:

1. **Free heuristics** (`_shared/memory.ts`) read a day of real lines and pick
   the ones worth keeping — promises, plans, dates, firsts, feelings, gifts,
   places, milestones — in English *and* Hinglish. The same pass pulls durable
   facts straight out of their own sentences ("loves filter coffee", "birthday:
   12 March", "allergic to peanuts"), which are stored with no AI at all.
2. **One model call, only for the top ~5%.** The strongest lines of the window
   are handed to one `extract` call (private tier, ≤5 facts). If it fails, the
   free pass stands — nothing is lost.

```bash
supabase db push                          # adds 20261008090000_twin_memory.sql
supabase functions deploy twin-nightly
supabase functions deploy ai-memory-extract   # same function, heuristics-first now
```

What the database gives you:

- `ai_memories` grew up: `pinned`, `importance`, `seen_count` / `last_seen_at`
  (a fact that keeps coming back rises), `archived`, `day`, `message_id`, `kind`.
- `message_highlights` — the lines the twin kept, readable by both partners and
  written only by the service role.
- `twin_memory_upsert(...)` — the single writer: dedupes on lowercase fact,
  never lets an auto fact overwrite a manual one, never loses a pin.
- `twin_memory_pin()` / `twin_memory_forget()` — either of you, any time.
- `twin_memory_search(query, subject, k)` — trigram search with pinned first;
  the twin's prompt now asks "what relates to what she just said" instead of
  taking the eight newest facts.
- `twin_day_messages(day)` — one day of real lines, filtered (service role only).
- `twin_nightly_state()` / `twin_nightly_log()` / `twin_nightly_runs` — the sweep
  is refused less than 3 h after the last one (the owner may force a second).

Running the sweep:

```bash
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npm run twin:nightly -- --days 7          # add --force to repeat
```

Or schedule it in the database (pg_cron + pg_net), see the header of
`scripts/twin-nightly.mjs` for the exact `cron.schedule(...)` statement.

Cost: a sweep over 7 days is **0 calls** unless a line scores high enough to be
worth asking about, and then it is **one** call. Browsing memories, pinning,
forgetting and highlighting cost nothing. The control room (`/you/twin`) now has
a "What the twin remembers" card with the pin / forget controls, the stats and a
"Feed it now" button.

## 8. Deploy reference (by name — rule #10)

```bash
supabase functions deploy embed-backfill
supabase functions deploy build-style-card
supabase functions deploy spell-login
supabase functions deploy twin-greet
supabase functions deploy seed-greetings
supabase functions deploy decoy-login
supabase functions deploy book-page
supabase functions deploy twin-reply
supabase functions deploy twin-nightly
supabase functions deploy ai-memory-extract
supabase functions deploy twin-actions
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
- One away-reply: **1 private call**, ≤3/day by default, ≥45 min apart.
- One twin-chat turn: **1 private call** (a second only when the guard trips).
- A memory sweep: **0 calls** normally, **1** at most, and it stores what it can
  even when the call fails.
- Everything personal stays on `noTrain: true` providers (Groq / Cerebras / Cloudflare).
