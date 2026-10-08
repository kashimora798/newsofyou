# NewsOfYou — the one implementation guide

Everything in this file is **yours to run**. Nothing here has been executed
against your Supabase project: the sandbox that wrote the code has no access to
it. Work top to bottom once, then use §10 as the checklist for every future
change.

- Router and model details live in [`LLM_ROUTER.md`](./LLM_ROUTER.md).
- The twin's pipeline notes live in [`TWIN_SETUP.md`](./TWIN_SETUP.md).
- This file is the map: **what to run in the database, in what order, and why.**

---

## 1. What is already built (by phase)

| Phase | What it is | DB migration | Edge functions |
|---|---|---|---|
| 0 | One LLM router, free providers, failover, budget | `20261002120000_llm_router.sql` | all AI functions |
| 1 | Memory index: sessions, chunks, reply pairs, style card | `20261002130000_twin_foundation.sql` + `20261003090000_twin_tuning.sql` | `embed-backfill`, `build-style-card` |
| 2 | Spell login + greeting bank (~300 lines, no LLM on the hot path) | `20261004090000_twin_greetings.sql` | `spell-login`, `twin-greet`, `seed-greetings` |
| decoy | Front page = school portal; decoy credential opens a study app | `20261005090000_decoy_login.sql` | `decoy-login` |
| 3 | Home scene (night world, mobile-first) | — | — |
| 6 | The Book — one free page per day, LLM only on request | `20261006090000_twin_book.sql` | `book-page` |
| 4 | Her chat with the twin + the away-reply in the real chat | `20261007090000_twin_chat.sql` | `twin-reply` |
| 5 | Memory 2.0 — heuristics first, the model only for the top 5% | `20261008090000_twin_memory.sql` | `twin-nightly`, `ai-memory-extract` |
| 7 | Assistant actions — the twin proposes, you tap | `20261008120000_twin_actions.sql` | `twin-actions` |
| 8 | Face to Face — the hard-conversation room | `20261008150000_twin_ftf.sql` | `face-to-face` |
| 9a | Media compression (storage + quality) | — | — |
| 9b | Printed book (A5, one day per page) + owner maintenance | — | `twin-maintenance` |

With that, every phase of the plan is built. What remains is not a phase: it is
live use — apply §2–§9 once, then keep adding lines, pages and rooms.

---

## 2. Before anything else: the one-time setup

```bash
# 1. Link this folder to your project (once per machine)
supabase link --project-ref <your-project-ref>

# 2. Push every migration. Idempotent: safe to re-run.
supabase db push
```

Then the secrets the AI needs (set once; never in the app):

```bash
supabase secrets set \
  GROQ_API_KEY=... \
  CEREBRAS_API_KEY=... \
  CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
  # optional: OPENROUTER_API_KEY / GEMINI_API_KEY for the low-sensitivity tier
  LLM_DAILY_TOKEN_BUDGET=60000
```

**One key is enough** to run everything. The router walks each task's chain and
skips a provider it has no key for.

### Seed the single config row

The twin has exactly one row (`twin_config.id = 1`). Fill it with your two user
ids and names:

```sql
insert into public.twin_config (id, owner_user_id, partner_user_id, owner_name, partner_name, timezone)
values (
  1,
  '<his-user-uuid>',        -- the twin speaks as this person
  '<her-user-uuid>',        -- the twin talks with this person
  'Kratagya', 'Anshika', 'Asia/Kolkata'
)
on conflict (id) do update set
  owner_user_id   = excluded.owner_user_id,
  partner_user_id = excluded.partner_user_id,
  owner_name      = excluded.owner_name,
  partner_name    = excluded.partner_name,
  timezone        = excluded.timezone;

-- Her yes, only from her account (asked for by name in the app):
--   select public.twin_record_consent();       -- run as her
-- He switches it on:
--   select public.twin_set_enabled(true);      -- run as him
```

---

## 3. Build the twin's memory (Phase 1)

```bash
supabase functions deploy embed-backfill
supabase functions deploy build-style-card
```

```sql
-- 1. Cut the chat into sessions, chunks and reply pairs (free)
select public.twin_rebuild_all(true);

-- 2. How many rows still need vectors?
select
  (select count(*) from public.chat_chunks where embedding is null) as chunks,
  (select count(*) from public.reply_pairs where embedding is null) as pairs;
```

```bash
# 3. Fill the vectors — free, inside Supabase (gte-small, 384 dims)
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/embed-backfill.mjs
```

```sql
-- 4. One private LLM call: the style card (his voice, editable in /you/twin)
select public.twin_style_card;   -- after calling build-style-card from the UI
```

Verify:

```sql
select * from public.match_reply_pairs(
  (select embedding from public.chat_chunks limit 1), 5, null);
select * from public.match_chunks(
  (select embedding from public.chat_chunks limit 1), 'khana', 5);
```

---

## 4. The front door (Phase 2 + decoy)

```bash
supabase functions deploy spell-login twin-greet seed-greetings decoy-login
```

- The public domain (`myanshika.xyz`) shows the **school portal sign-in**.
- The decoy credential `12S-27` + its password opens a **study app** (`/study`)
  with believable, fake study data — never the real chat.
- The real door is **`/real`** (also `/you/login`): the spell login. `/login` is
  deliberately NotFound.

Greeting bank (about 300 pre-written lines, 9 free calls, one time):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-greetings.mjs
# or tap "Top up" in /you/twin
```

Set the decoy password in the UI: **Settings → Decoy** (stored hashed).

---

## 5. The Book (Phase 6)

```bash
supabase db push                      # 20261006090000_twin_book.sql
supabase functions deploy book-page
```

Nothing else. Opening `/book` composes a page from your own lines for free; only
"ask the twin to write this day properly" spends one call, one time, per day.

> The Book reads from `chat_sessions`, so finish §3 first or the days will be
> empty.

---

## 6. Twin chat + the away-reply (Phase 4)

```bash
supabase db push                      # 20261007090000_twin_chat.sql
supabase functions deploy twin-reply
```

- `/twin` — her private chat with the twin. Threads are private at birth;
  sharing one with him is a per-thread toggle.
- The away-reply appears in `/chat` as a labelled AI line when he has really
  been offline past the wait. It is **never** written into `messages`.

Turn it on in **`/you/twin` → "Twin chat & away-reply"**: switches, the wait
(default 25 min), max per day (3) and the minimum gap (45 min), plus "Answer her
now" to try it on purpose.

Verify the gate (as the service role):

```sql
select public.twin_autoreply_state();   -- {eligible, reason, ...}
select public.twin_autoreply_for_chat(72);
```

---

## 7. Memory 2.0 (Phase 5)

```bash
supabase db push                      # 20261008090000_twin_memory.sql
supabase functions deploy twin-nightly ai-memory-extract
```

Run a sweep now (free unless it asks the model — then exactly one call):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run twin:nightly -- --days 7
```

Nightly, for real — pick **one**:

```sql
-- Option A: inside Postgres (needs pg_cron + pg_net enabled in the dashboard)
select cron.schedule('twin-nightly', '30 2 * * *', $$
  select net.http_post(
    url     := 'https://<project>.supabase.co/functions/v1/twin-nightly',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer <service-role-key>',
                 'Content-Type', 'application/json'),
    body    := jsonb_build_object('days', 7));
$$);
```

```bash
# Option B: cron on any always-on machine
30 2 * * * cd /path/to/newsofyou && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run twin:nightly -- --days 7
```

Same for the scheduled messages the twin sets up for you:

```sql
select cron.schedule('scheduled-messages', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<project>.supabase.co/functions/v1/send-scheduled-messages',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>',
                                  'Content-Type', 'application/json'),
    body    := '{}'::jsonb);
$$);
```

Verify:

```sql
select public.twin_memory_stats();
select * from public.twin_memory_search('birthday', null, 5);
select * from public.twin_highlights_recent(10);
```

---

## 8. Assistant actions (Phase 7)

```bash
supabase db push                      # 20261008120000_twin_actions.sql
supabase functions deploy twin-actions
```

How it behaves:

1. Something asks ("remind me to call mum at 7") — **one** call turns it into one
   card.
2. The card shows exactly what will be written and when. Nothing has happened.
3. A person taps **Yes**. `twin_action_decide` records the tap; the function then
   writes the row (a scheduled message, a reminder, or a calendar event).
4. Cards expire after 24 h on their own. `select public.twin_actions_expire();`
   is also callable from any cron you already run.

Read-only asks never need a tap: **daily summary**, **plan**, and **"say it a
little better"** (which is now what the ✨ button in the chat uses).

Verify:

```sql
select public.twin_actions_list(10);
```

---

## 8b. Face to Face (Phase 8)

```bash
supabase db push                      # 20261008150000_twin_ftf.sql
supabase functions deploy face-to-face
```

A room for the conversation that is too heavy for the chat. One topic, both of
you, six ground rules you both agree before a word is exchanged (`ftf_agree` —
the room genuinely refuses turns until then).

- Turns alternate. Before sending, either of you can tap the wand: one private
  `face_to_face` call rewrites what you wrote so the point survives and the blame
  does not. You read it, you can edit it, and you choose — **only what you choose
  is stored**, with your original kept beside it (nothing can be misquoted).
- Either of you can pause, without saying why. That is a ground rule, not a bug.
- **When a turn carries a self-harm or abuse signal the room stops.** No more
  mediation, no closing note: both of you are shown real helplines (Tele-MANAS
  14416, AASRA, KIRAN, iCall, 181, 112) and the assistant is out of it. The flag
  is recorded on the turn.
- “Wrap up” writes the closing note: the free version needs no AI at all, and
  with AI it adds what each of you asked for and one small next step.
- Rooms nobody returns to fade after 48 h (`ftf_sweep`, also called by
  `twin-nightly` and by the Tidy up button below).

Verify:

```sql
select public.ftf_state();        -- the open room, if any
select * from public.ftf_recent(12);
```

Route: `/face-to-face` (also in the Gather drawer on Home, and linked from the
twin chat).

---

## 8c. Maintenance: the owner's one button (Phase 9)

```bash
supabase functions deploy twin-maintenance
```

`/you/twin` → **Maintenance** does the two things that otherwise need a
terminal, owner-only:

- **Build the index** — `twin_rebuild_all(true)` in SQL, then it loops
  `embed-backfill` until every chunk and reply pair has a vector, and reports
  how many it filled and what is still missing. Free; it never touches
  `messages`.
- **Tidy up** — closes action cards nobody tapped and fades rooms nobody
  returned to. The same two things happen inside `twin-nightly`.

The card also shows readiness (sessions, reply pairs, vectors missing, open
cards, open rooms, last sweep). If the vectors are still incomplete after a tap,
just tap again — it is batched on purpose so no single request runs too long.

---

## 8d. The printed book (Phase 9)

Nothing to run. Open `/book/print` (or the “print the whole book” pill on the
book's cover screen):

- one day per page, the cover first, a closing page last;
- A5 portrait with 16 mm margins, colour preserved — the exact thing a print
  shop asks for;
- **Print / Save as PDF** in the toolbar is the export. Days that were never
  opened still print, because the browser composes them for free.

Ask the shop for "print as-is, no scaling".

---

## 9. Media: storage load, and the honest answer about quality

### What the app does now (no database step at all)

Every image you attach is re-encoded **on your phone, before upload**:

- long edge capped (default 2400 px — sharp on any screen you actually use),
- modern codec (WebP when the browser can write it, JPEG otherwise),
- quality walked down only until the file fits, never below 0.62,
- videos and GIFs are **never** touched (re-encoding those is a different job),
- anything over 4 MB is always shrunk; under 600 KB is left alone,
- if the result would be bigger or the image cannot be read, the original ships
  unchanged. A send is never blocked by compression.

Typical result for a 12 MP phone photo: **4 MB → 300–600 KB**, and nobody can
see the difference on a phone or a laptop screen.

There is a toggle in **Settings → Storage** ("Shrink photos before sending", on
by default). It is a device-local preference: it does not sync, it just decides
whether *your* phone bothers to shrink first.

Alongside each master, a **480 px preview** is uploaded as a sibling
(`photo.webp` → `photo.thumb.webp`). It costs ~20–40 KB and exists so lists,
book pages and future grids can show a picture without pulling a full master
down. Nothing points at it yet; it is there for when they do.

### "Can we get the quality back without using more storage?"

Short answer: **partly yes, and in one direction it is genuinely free.**

1. **Pixels that were thrown away cannot be returned.** If an image was shrunk to
   800 px, no later trick brings the 4000 px back. Anyone who tells you otherwise
   is selling a sharpening filter.
2. **But the same pixels can be stored smaller.** That is what this phase spends
   its one free lunch on: a JPEG is an old, wasteful format. The same photo, same
   pixel dimensions, same *perceived* quality, as WebP/AVIF, is typically
   30–70% smaller. So the master you open at "full size" is usually **better per
   byte** than what you uploaded — smaller *and* just as sharp. That is the only
   honest way "quality comes back without storage going up".
3. **If you truly want the originals back**, the only way is to keep them
   somewhere that is not Supabase storage:
   - the phone's own gallery (which already has them — we never delete anything
     locally), or
   - a cheap cold bucket (Backblaze B2, Cloudflare R2, an old drive) with one
     upload per file, catalogued by the same path. A future phase can add that
     as a "keep the original in cold storage" toggle; it costs nothing to store
     and only the network when you open it, but it *is* storage somewhere.
4. **What is already lost, is lost.** Any photo sent before this phase was
   uploaded at full size, so nothing was discarded — those are your safest
   copies. Going forward, the master is the best copy: still 2400 px, still
   visually identical, 70–90% smaller.

### Numbers to plan storage with

| Item | Typical size now | Notes |
|---|---|---|
| Chat photo (master) | 300–600 KB | was 3–5 MB |
| Chat photo (preview) | 20–40 KB | grids and lists |
| Voice note (1 min) | 0.5–1 MB | untouched, it is already compressed |
| Video | as recorded | untouched on purpose |
| Book page | a few KB | text only; photos are referenced, not copied |
| Twin chat / memories / highlights | a few KB per row | text |

A couple sending 10 photos a day for a year lands around **1.5–2.5 GB** with the
shrink on, versus **12–18 GB** without it.

### If you ever want tighter or looser

All the knobs are in one place: `MEDIA_LIMITS` in `src/lib/media.ts`
(`maxDimension`, `quality`, `minQuality`, `compressAboveBytes`,
`alwaysShrinkAboveBytes`, `thumbWidth`). Change a number, run
`npm run build`, redeploy the site. No migration, no function deploy.

---

## 10. Deploy reference (by name — never deploy `_shared` alone)

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
supabase functions deploy twin-actions
supabase functions deploy face-to-face
supabase functions deploy twin-maintenance
supabase functions deploy ai-memory-extract
# plus everything in LLM_ROUTER.md after a router change
```

Secrets: AI provider keys (§2) and optionally `EMBED_SECRET` (only if you prefer
the `x-embed-secret` header over the service-role key for backfills).
**No secret ever goes to the client.**

### After every change, in this repo

```bash
npm run check:sql           # migrations parse (currently 40/40)
npm run inline:llm          # regenerate the inlined copies
npm run inline:llm:check    # CI gate: refuses stale copies
npm run test:llm            # shared-module behaviour (currently 67/67)
npm test                    # vitest (7/7)
npx tsc -p tsconfig.app.json --noEmit   # 35 pre-existing errors, 0 new
```

Rule of thumb: if you edit anything in `supabase/functions/_shared/`, run
`npm run inline:llm` before deploying, and deploy **every** function that uses
it — the script tells you which ones changed.

---

## 11. Cost, by design

| Action | Calls |
|---|---|
| Opening Home, the Book, a book page, the greeting | 0 |
| Talking matters: browsing memories, pinning, highlights | 0 |
| Her chat with the twin, one turn | 1 (`twin_chat`, private tier) |
| An away-reply | 1, ≤3/day, ≥45 min apart |
| A memory sweep (7 days) | 0 normally, 1 at most |
| "How was today?" | 1 (`summary`), cached per day |
| A plan or a draft rewrite | 1 each |
| A card being confirmed | 0 — it is a database write |
| Opening a Face to Face room, agreeing, sending a turn as written | 0 |
| Asking for a gentler version of one turn | 1 (`face_to_face`) — and nothing is stored unless you send it |
| Wrapping up a room | 1 (`summary`), with a free fallback note |
| Printing the book, building the index, tidying up | 0 |
| Every photo you send | 0 — compression is on-device |

Daily budget: `LLM_DAILY_TOKEN_BUDGET` (default 60 000). When it runs out,
functions degrade to their non-AI path — greetings use the bank, the twin says
it is resting, cards are simply not proposed.

---

## 12. Privacy, in one place

1. Nothing personal ever reaches a provider that trains on data: `private` work
   only goes to `noTrain: true` providers (Groq, Cerebras, Cloudflare). Gemini
   and OpenRouter are reserved for `low`-sensitivity work (a game hint, a daily
   question).
2. The twin is labelled as AI everywhere, and never claims to be human.
3. Her chat threads are private at birth; sharing is per-thread and reversible.
4. Consent comes first: nothing is generated until `partner_consented_at` is set
   from her account, and either of you can switch it off.
5. Only redacted snippets travel to the model. `messages` is read-only to the
   twin in every path — no function in this repo writes to it except the app's
   own send path.
6. No prompt content is stored in `llm_usage`; it records counts and tokens only.
7. A Face to Face turn is never rewritten silently: the softened version is a
   suggestion you can edit, and your original is kept beside it.
8. If a turn signals self-harm or abuse, the assistant stops and real helplines
   are shown — it does not try to handle it.

---

## 13. Troubleshooting

| Symptom | Look here |
|---|---|
| "Twin is not configured yet" | §2 — the `twin_config` row |
| Greetings are stale duplicates | `/you/twin` → Greeting bank → Rebuild |
| Book days are empty | §3 — `twin_rebuild_all(true)` and the embed backfill |
| Twin replies ignore your old chats | `select count(*) from public.reply_pairs where embedding is not null;` |
| Cards never appear in `/twin` | the phrase must match a kind — "remind me to…", "send him a message at…", "add an event…" |
| Auto-reply never fires | it needs him **offline** past the wait, her last message unanswered, and the day/gap budgets to allow it — `/you/twin` shows "nothing sent" plus the reason |
| Storage still growing fast | Settings → Storage, and check videos — they are deliberately untouched |
| Face to Face says the rules are not agreed | both of you tap "I agree" — the room waits for both, by design |
| A room says "paused" and will not take a turn | either of you can resume; a pause needs no reason |
| The book prints blank pages | days with no lines that day are intentionally quiet — untick "only days with a written page" |
| Everything AI fails | `select * from public.llm_usage order by day desc limit 20;` and the secrets in §2 |
