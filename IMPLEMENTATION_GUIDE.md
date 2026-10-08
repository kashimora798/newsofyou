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
| 9c | Chat media drawn the way WhatsApp does: albums, bare photos, document cards | `20261008180000_chat_attachments.sql` | — |
| 9d | Fast, light and secure: no 3D, −60% first load, SSRF and open-function fixes, headers | — | `fetch-link-preview`, `send-scheduled-messages` (hardened) |

With that, every phase of the plan is built. What remains is not a phase: it is
live use — apply §2–§9d once, then keep adding lines, pages and rooms.

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

Steps 1–3 above are also a single tap once `twin-maintenance` is deployed:
**`/you/twin` → Maintenance → “Build the index”** does the rebuild and then loops
the vector backfill until nothing is missing. The terminal route stays for a
machine with the service key and for the very first build.

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
(`photo.webp` → `photo.thumb.webp`). It costs ~20–40 KB and is what photo
clusters in the chat draw, so scrolling never pulls full masters down. The
master is fetched only when a photo is opened, and if a preview is missing the
image silently falls back to the full file.

**Every upload site goes through the same door** (`src/lib/uploadImage.ts`):
the chat's attachments, avatars (512 px), chat wallpapers (1600 px) and stickers
(512 px, as PNG so a sticker keeps its transparency). The chat's own path in
`MessageInput` does the same shrink and additionally records what the file *is*
(see §9c). Animated GIFs and videos are always passed through byte-for-byte.

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

## 9c. Media in the chat, the way WhatsApp draws it (Phase 9c)

The thread now lays media out the way the screenshot in the brief asked for.
Nothing about `messages` changed — it is still append-only and read-only to us.
Everything below is *rendering* plus one small side table.

**What you will see**

| Sent | Drawn as |
| --- | --- |
| One photo, no caption | the photo bare (no bubble), with the time and the ticks on the picture |
| Two to ten photos, same sender, no captions, within 3 minutes | one rounded cluster with thin seams — 2 side by side, 3 as a square with a tall first tile, 4+ as 2×2, extras counted as `+3` |
| Any photo with a caption, a reply or a reaction | an ordinary bubble, so nothing is lost |
| A PDF or other document | a card: coloured label square, the filename, then `2 pages • 1.1 MB • PDF`, with a download arrow |
| A video | a thumbnail, a play button, and the length in the corner |
| Tapping a photo in a cluster | opens the viewer on that photo; `←` `→` or the arrows step through the rest of the album |

**The one database piece**

Migration `supabase/migrations/20261008180000_chat_attachments.sql` — run it with
`supabase db push` (same command as every other migration; it is idempotent).

```sql
-- what it adds, in one breath:
chat_attachments   -- one row per uploaded file, keyed by its storage path
chat_attachment_save(...)   -- upsert; only fills blanks, never overwrites with null
chat_attachments_for(text[])  -- the rows for the media currently on screen
```

RLS is on with a partner-read policy; the save function only ever writes rows
whose path is inside the caller's own folder, so neither partner can claim the
other's file. **Nothing breaks before you push it** — if the table is not there
yet the chat simply draws photos without reserved height and documents without
the page count. No edge function, no secret, no key.

**Where the page count comes from.** The sender's own browser reads the PDF's
page tree out of the first and last 512 KB of the file (`src/lib/pdfMeta.ts`).
The file never leaves the device to be measured, and it is only read at all
because the number has to live somewhere the other phone can see it. If the
count cannot be told confidently, the card shows `1.1 MB • PDF` instead of
guessing.

**Cheap by construction.** Each cluster draws the `.thumb` sibling that the
upload already writes (480 px, ~10–20× smaller), so scrolling a wall of photos
never pulls full masters down; the master is fetched only when a photo is opened,
and if a preview is missing the image silently falls back to the full file.

**How to test it**

1. `supabase db push`, then `npm run dev`.
2. Open the chat and attach **several photos at once** (the picker is now
   multi-select). They should land as one cluster with the time under it.
3. Attach a PDF and check the card reads `N pages • size • PDF` on both phones.
4. Reload the page — the geometry and the card details must be identical,
   because both come from the database rather than from local memory.
5. `npx vitest run` → 24 tests, including the album geometry and the PDF
   counter.

---

## 9b. Putting it online (myanshika.xyz)

The site is a static build; all the private work happens in Supabase.

1. **Build on the host, not in this sandbox** (the production build is memory
   hungry and OOMs locally). On Vercel: framework Vite, build `npm run build`,
   output `dist`. `vercel.json` already rewrites every path to `/`, so `/book`,
   `/twin` and `/face-to-face` survive a refresh instead of 404-ing.
2. **Environment variables on the host** (never a service key):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon key — public by
   design), optionally `VITE_GIPHY_API_KEY`. Everything else lives in
   `supabase secrets set` and never reaches the browser.
3. **Domain**: add `myanshika.xyz` (+ `www`) in the host's dashboard, then point
   the registrar's A/CNAME records where it says. Wait for the certificate.
4. **Check the four doors after the first deploy:**
   - `/` → the school portal (this is what a stranger sees)
   - `/study` → only after the decoy credential; the fake student portal
   - `/real` (and `/you/login`) → the spell door
   - `/login` → 404 on purpose
   - `/home`, `/book`, `/twin`, `/face-to-face` → login required
5. **Rotate the decoy password** (Settings → Decoy) once the domain is live.

Nothing about this step touches the database; the edge functions are already
deployed and run on Supabase.

---

## 9d. Fast, light and secure (the P0 pass)

Measured on this machine with `npm run build` and `gzip -9`, before → after:

| | Before | After |
| --- | --- | --- |
| What the first screen downloads | 589 KB gzip JS | **218 KB JS + 26 KB CSS** |
| Requests before it can draw | entry + 5 `modulepreload`s | **1 script** |
| three.js | 621 KB chunk + a 4.0 MB `ez-tree` chunk | **gone** |
| `public/` | 84.82 MB | **68 KB** |
| Build output | 111 MB | **21 MB** |
| Runtime dependencies | 62 | **57** |
| `tsc` baseline | 35 errors | **26** |
| Tests | 29 | **45** |

### There is no 3D any more

The forest was a WebGL scene: 11 bark texture sets, leaf PNGs, seven `.glb` models
and an ambience track, 84 MB of assets, to draw one tree. It is gone — as requested.

- **"Our Tree" lives on.** `src/lib/treeGrowth.ts` holds the stages (Sapling →
  Ancient & Eternal) as plain data; `src/components/tree/OurTree.tsx` draws one
  SVG tree that grows with them; `/forest` is now that page. The Wrapped "secret
  garden" card uses the same tree with no canvas.
- **It reads far less.** The old page paged through *every message in the
  conversation*, 200 rows at a time, downloading text it never showed. Now
  `useTreeGrowth` asks the database to **count** — one request, one number, the
  same cost whether you have 50 messages or 50,000.
- **The safety net.** `src/test/perfGuards.test.ts` fails if `three`,
  `@react-three/*` or `ez-tree` ever come back, if the texture/model folders
  reappear, or if `manualChunks` is re-added to `vite.config.ts`.

### Why the first load was 589 KB, and why it is 218 KB

`vite.config.ts` had a `manualChunks` block pinning three/charts/vendor/react
into named chunks — and Vite preloads every chunk in the entry's static graph.
The decoy portal was therefore pulling a WebGL engine and a chart library before
it could draw a word. The block is gone, and the three heaviest pages that were
statically imported (`AdminDashboard`, `HiddenLogin`, `SecretLogin`) are now
lazy. `/` is the landing page and stays eager, so it still paints in one trip.

To move it further, later: the remaining 218 KB is React, the router, Supabase,
Radix and framer-motion. It can be trimmed, but each cut is a real trade-off
against the animations and controls you asked for — a P1/P2 job, not a free win.

### Fonts

Seven Google-Fonts imports became two (`Nunito`, `Quicksand`, `Caveat`). The
themed faces — typewriter, pixel, horror, romance — are fetched **when their
theme is worn**, by `src/lib/themeFonts.ts`. A visitor to the decoy portal no
longer downloads a horror font it can never show.

### The two security holes that were open

**1. `fetch-link-preview` was an open proxy.** It took a URL from anyone, with
no sign-in, no scheme check and no size cap, and fetched it from inside
Supabase's network — reachable: the cloud metadata endpoint
(`169.254.169.254`), your local Supabase stack, any private host, plus free
bandwidth and a port scanner. It now:

- requires a **partner session** (the app already sends one — no change needed);
- allows only `http`/`https`, on ports 80/443, with no credentials in the URL;
- **resolves the host** and refuses loopback, RFC1918, link-local, CGNAT,
  benchmarking, multicast, IPv6 unique-local, and IPv4-mapped IPv6 — so a
  hostname pointing at `127.0.0.1` is refused too;
- follows at most **2 redirects, re-checking each hop**;
- caps the body at **256 KB**, times out at 5 s, and only parses `text/html`;
- answers vaguely on failure, so a probe learns nothing.

Verified with 33 checks against the real code (metadata IP, IPv4-mapped IPv6,
private-range hostnames, mixed public/private answers, wrong schemes and ports).

**2. `send-scheduled-messages` accepted anyone.** It holds the service-role key
and sends every due scheduled message, and it asked for no proof at all. It now
requires the service-role bearer token **or** the shared job secret, delivers at
most 100 per call, and marks rows sent only while still unsent — so two callers
racing can never double-send.

### Headers, crawlers and the shell

- `robots.txt` refuses every crawler (wildcard and named ones); `index.html`
  carries `noindex, nofollow, noarchive, nosnippet` and `referrer: no-referrer`.
- `vercel.json` adds a Content-Security-Policy (`frame-ancestors 'none'`,
  `object-src 'none'`, no inline script), HSTS, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy` (microphone and camera stay allowed for voice notes and
  photos), plus `immutable` caching for hashed assets and revalidation for the
  HTML.
- The page shell now paints its own colour immediately (an inlined splash), names
  Supabase and the font host via `preconnect`, and drops the expired
  Google-Storage `og:image` that leaked authorship.

### What you still have to do by hand

1. **Deploy the two hardened functions** (the app keeps sending link previews
   with its session token, so nothing else changes):
   ```bash
   supabase functions deploy fetch-link-preview
   supabase functions deploy send-scheduled-messages
   ```
2. **Give the scheduler a secret** (only if you drive scheduled messages from a
   cron or the local runner):
   ```bash
   supabase secrets set SCHEDULED_JOB_SECRET=$(openssl rand -hex 24)
   ```
   then call the function with `x-job-secret: <that value>` (or the service-role
   bearer, which `scripts/twin-nightly.mjs` already uses).
3. **Turn off public sign-ups in Supabase** — Dashboard → Authentication →
   Sign In / Providers → disable "Allow new users to sign up". This one cannot
   be done from a file and it matters: the whole security model assumes the
   database only ever holds the accounts you created. Do it before the domain
   goes live.
4. **Set your real title/description** if you want the decoy to read differently
   (`index.html` currently says `EduflowAi` / `Study dashboard`).

### How to check it stayed fixed

```bash
npm run build                      # then look at dist/index.html — one script, no preloads
npx vitest run                     # 45 tests, including the guards above
du -sh public                      # should be a few KB, never tens of MB
curl -sI https://myanshika.xyz | grep -iE 'content-security|strict-transport|x-frame'
```

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
supabase functions deploy fetch-link-preview
supabase functions deploy send-scheduled-messages
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
| Twin replies ignore your old chats | `count(*)` on `reply_pairs where embedding is not null` — or just tap Build the index in `/you/twin` |
| Cards never appear in `/twin` | the phrase must match a kind — "remind me to…", "send him a message at…", "add an event…" |
| Auto-reply never fires | it needs him **offline** past the wait, her last message unanswered, and the day/gap budgets to allow it — `/you/twin` shows "nothing sent" plus the reason |
| Storage still growing fast | Settings → Storage, and check videos — they are deliberately untouched |
| Face to Face says the rules are not agreed | both of you tap "I agree" — the room waits for both, by design |
| A room says "paused" and will not take a turn | either of you can resume; a pause needs no reason |
| The book prints blank pages | days with no lines that day are intentionally quiet — untick "only days with a written page" |
| Everything AI fails | `select * from public.llm_usage order by day desc limit 20;` and the secrets in §2 |
