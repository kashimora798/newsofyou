# The fast · light · secure pass

*What I measured, what is actually wrong, and the order I would fix it in.*

This is a plan, not a promise: every number below came from this repo, on this
machine, from real commands (they are quoted so you can re-run them). Nothing
here changes `messages`, the phases you already have, or anything the two of you
use today. Where a change needs your decision, it is called out.

---

## 0. What I measured first

### 0a. Weight — what a visitor downloads

| Thing | Now | Where it comes from |
| --- | --- | --- |
| **First load JS on the login screen** | **589 KB gzip** | entry + `vendor` + `supabase` + **`three`** + **`recharts`**, all forced into the first request |
| After two config fixes (build-verified) | **221 KB gzip** | one file, no three.js, no recharts |
| `public/` static assets | **84.82 MB** | of which `textures/` is 79 MB |
| …of which anything in the code ever fetches | **6.42 MB** | `Bark002`'s 4 maps + 3 ground maps + 4 leaf PNGs |
| …never fetched by any code path | **≈ 71.6 MB** | 10 unused bark sets (69.11 MB) + every `_NormalDX.jpg` (22.07 MB, code only ever loads `_NormalGL`) |
| Fonts | **7 blocking requests, 10 families** | one `@import` per family group in `src/index.css` |
| `ez-tree` (the forest) | one chunk of **4.0 MB raw / 3.0 MB gzip** | `@dgreenheck/ez-tree` — only on `/forest`, but it is enormous |
| Whole build output | 111 MB | mostly a copy of `public/` |

How I got this:

```
NODE_OPTIONS=--max-old-space-size=3072 npm run build      # works; without the flag it OOMs
gzip -9 -c dist/assets/*.js | wc -c                       # per-chunk gzip sizes
```

**Why the login page is heavy** (this is the single biggest problem in the app):
`vite.config.ts` has a `manualChunks` block that assigns `three`, `recharts`,
react and Supabase to named chunks. Vite then `modulepreload`s **every** chunk in
the entry's static graph, so the school-portal screen pulls three.js and a chart
library before it can draw a single word. I proved it by building with
`manualChunks` removed: entry 239 KB gzip, no preloads, and `WebGLRenderer` and
`ResponsiveContainer` no longer appear anywhere in the entry. Making the three
heavy statically-imported pages lazy as well took it to **221 KB gzip**.

**Why 71 MB of textures are dead:** `src/components/forest/vanilla/textures.ts`
has its own `BarkType` map keyed `Bark001…Bark015`, but the value it is asked for
comes from `@dgreenheck/ez-tree`, where `BarkType.Oak === "oak"` and
`BarkType.Willow === "willow"`. `BarkType["oak"]` is `undefined`, so every tree
falls through to the comment *"Fallback to a high-quality realistic bark
texture"* and loads **`Bark002` only**. Ten of the eleven sets can never load.

### 0b. Data — what the app spends while it is open

| Source | Interval | Notes |
| --- | --- | --- |
| `useMessages` fallback poll | 4 s | only when the realtime socket is down, but it is unconditional after that |
| `usePartner` fallback poll | 10 s | `select("*")` |
| `usePartnerAwayMessage` | 30 s | re-render tick |
| `useFaceToFace` | 20 s | room state |
| `useTwinChat` / `useTwinActions` | 60 s / 90 s | full list reloads |
| `useSoulmateClock`, `useOnlineStatus` | 30 s / heartbeat | presence + activity |
| Sky effects (`Aurora`, `Rainbow`, `SkyBackground`) | 90 s–120 s | re-checks |
| Realtime channels | 33 `supabase.channel(` call sites | `messages-realtime`, typing, ban-watch, sky-lanterns, per-game rooms |

No timer anywhere is gated on `document.visibilityState`, so a phone in a pocket
with the tab "open" keeps paying for all of it. And 24 queries use
`select("*")`, including hot hooks like `usePartner` and `useCurrentUser`.

Media is in better shape (compression + `.thumb` siblings shipped earlier this
week), but only **13 of 41** `<img>` tags are lazy, and video elements have no
`preload="none"`/poster discipline. There is no service worker, so a repeat visit
re-downloads the shell and the fonts.

### 0c. Security — ranked, with the evidence

| # | Finding | Where | Why it matters |
| --- | --- | --- | --- |
| 🔴 1 | **`fetch-link-preview` is an unauthenticated open proxy with no URL validation** | `supabase/functions/fetch-link-preview/index.ts` | `fetch(url)` on anything a caller sends, then `res.text()` with no size cap. That reaches `http://169.254.169.254/…` (cloud metadata), the local Supabase stack, or any internal host — and anyone with the public anon key can use it as free bandwidth at your expense |
| 🔴 2 | **`send-scheduled-messages` has no caller check** | `supabase/functions/send-scheduled-messages/index.ts` | It holds the service-role key and sends every due scheduled message. No auth guard at all: any caller can fire it repeatedly |
| 🟠 3 | **Storage buckets are public and world-readable** | `20260215061205_…sql`: `documents` bucket `public = true`, `SELECT USING (bucket_id = 'documents')`; `chat-images` created outside migrations | Every file ever sent has a permanent, unauthenticated URL. Inserts are allowed for *any* authenticated user, in *any* folder |
| 🟠 4 | **Sign-ups are presumably still open at the Auth level** | Supabase project setting (not in the repo) | `is_partner` protects `messages`, but several older tables still say `USING (true)` / `auth.role() = 'authenticated'` (`daily_checklists`, `shared_events`, …) — a stranger who signs up reads those |
| 🟠 5 | **Crawlers are explicitly invited in** | `public/robots.txt` = `Allow: /` for `*`; no `noindex` anywhere; title `EduflowAi`, description `100%YOU` | Google can index `/study`, `/real`, `/home`, `/book`. The decoy story leaks, and the private app becomes discoverable |
| 🟡 6 | **No security headers** | `vercel.json` has only a rewrite rule | No CSP, no `frame-ancestors`, no HSTS, no `nosniff`, no `Referrer-Policy`. A romance app is exactly the thing to clickjack or to leak URLs from |
| 🟡 7 | **Session lives in `localStorage`, no device lock** | `src/integrations/supabase/client.ts` | An unlocked phone, or any XSS, is a full session. There is a `user_login_sessions` table but no screen to see or revoke devices |
| 🟡 8 | **No backup, export or retention policy** | — | `llm_usage`, `llm_cache` grow forever; there is no "take our data out" button and no nightly dump |
| 🟡 9 | **`npm audit`/supply chain untouched** | `package.json` | 62 runtime deps, some heavy and decorative (`recharts`, `@imgly/background-removal`) |

**Already solid — I am not touching these:** 38/38 tables have RLS on, 11 of them
are service-role-only by design; `messages` is locked to partners, ban-aware, with
a receipt-only update trigger and a flood guard (`20260530120000_secure_rls.sql`);
no service-role key anywhere in the client; spell-login has attempt lockout; all
LLM calls go through one router.

---

## 1. The plan

Each phase lists **what**, **gain** (measured where I could measure it),
**risk**, and **how we verify**.

### P0 — Get the weight off (highest gain, near-zero risk, no decisions needed)

1. **Delete the `manualChunks` block in `vite.config.ts`** and make
   `AdminDashboard`, `HiddenLogin`, `SecretLogin` lazy. Keep `DecoyLogin`
   (the landing page) eager so `/` still paints in one round trip.
   *Gain: first load 589 → 221 KB gzip (−62%); three.js and recharts stop loading
   unless you actually open the forest or the stats page.*
   *Verify:* `dist/index.html` contains exactly one `<script>` and no
   `modulepreload`; a build-time budget script (P4) fails the build if three or
   recharts creep back in.
2. **Prune and re-encode the forest textures.** Keep `Bark002`'s four maps,
   delete the ten sets that can never load and every `_NormalDX.jpg`, and
   re-encode what stays to 512 px WebP.
   *Gain: 84.82 MB → ≈ 1.2 MB (…−98.6%); the repo, the deploy and a cold
   `/forest` visit all shrink by ~80 MB.*
   *Risk:* if the forest ever wants another bark type, it is one `webp` away — I
   will document the exact set in the guide.
   *Verify:* `du -sh public`, plus loading `/forest` with the network panel open.
3. **Fonts: 10 families → 3 eager + the rest on demand.** `Nunito`, `Quicksand`,
   `Caveat` stay in `index.css`; the theme faces (`Special Elite`, `Comic Neue`,
   `Silkscreen`, `Share Tech Mono`, `Creepster`, `Lora`, `Playfair Display`) move
   to a tiny loader that injects the `<link>` only when that theme is actually
   chosen or a letter is opened.
   *Gain: 7 blocking third-party requests → 2, and ~200–600 KB less on first load.*
   *Verify:* request count on a cold load; `prefers-reduced-motion` and offline
   behaviour unchanged.
4. **`index.html` / metadata hygiene.** Real title that matches the decoy, drop
   the expired Google-Storage OG image (it also leaks authorship), add
   `preconnect` for the Supabase origin, `color-scheme`, and a small inline
   splash so the first paint is never a blank white rectangle.
   *Gain: fewer round trips before the first byte of app code; no identity leak.*

### P1 — Make it *feel* fast

5. **Critical CSS + skeleton first paint.** Inline the handful of rules the login
   and home shells need, and preload the one font above the fold.
   *Gain: first contentful paint no longer waits on a 159 KB stylesheet.*
6. **Prefetch by intent.** After a successful spell login, prefetch the `/home`
   chunk; prefetch on touch/hover for nav links. The route is already
   code-split, so this is nearly free and removes the wait after tapping.
7. **Render less.** `React.memo` on `MessageBubble` with stable callbacks,
   `content-visibility: auto` on message rows, and windowing past ~200 rows.
   *Gain: typing and scrolling stop re-rendering 50 bubbles a frame.*

### P2 — Spend less data (the "light" part)

8. **One heartbeat.** Every periodic fetch (`usePartner`, `usePartnerAwayMessage`,
   `useFaceToFace`, `useTwinChat`, `useTwinActions`, sky re-checks, unread count)
   goes through a single scheduler that (a) pauses everything when the tab is
   hidden, (b) backs off to 60 s when the socket is healthy, (c) suspends when
   `navigator.onLine === false`, (d) resumes on focus.
   *Gain: an idle-but-open app goes from ~10 requests/minute across 8 timers to
   near zero; a pocketed phone stops spending anything.*
9. **One channel per screen.** Consolidate typing/presence/ban-watch into the
   existing `messages-realtime` channel, audit every `removeChannel` on unmount,
   and delete the 4 s fallback poll in favour of reconnect-driven catch-up.
10. **Explicit columns.** Replace `select("*")` in the hot hooks with the column
    lists they actually read, and cap every query with `.limit()`.
    *Gain: `usePartner` alone drops from a full row (including settings blobs) to
    the four fields the HUD shows.*
11. **Media discipline.** `loading="lazy"` + `decoding="async"` + reserved
    aspect ratios on the remaining 28 images, `preload="none"` + poster thumbs on
    video, thumbs first everywhere (the chat already does this), and skip
    decorative layers when `prefers-reduced-motion` or `save-data` is set.
12. **A service worker (≈ 60 lines, no dependency).** Shell + hashed assets
    stale-while-revalidate, storage *thumbnails* cached with a cap, **never**
    cache `/rest/v1/` responses. Plus an offline "last 50 messages and photos"
    view from IndexedDB.
    *Gain: repeat visits ≈ 0 bytes for the shell; the app opens instantly on a
    bad train connection and works with no signal at all.*

### P3 — Lock it down (the part that actually protects you both)

13. **Fix finding #1 — `fetch-link-preview`.** Require a partner JWT, allow only
    `http(s)`, resolve DNS and refuse loopback/RFC1918/link-local/metadata
    ranges, ≤ 2 redirects, stream-cap the body at 256 KB, keep the 5 s timeout,
    and cache results in a table so a link is fetched once ever.
14. **Fix finding #2 — `send-scheduled-messages`.** Require the same shared
    secret pattern as `embed-backfill` (or an owner JWT); the service role stays
    inside the function and the function stops being callable by strangers.
15. **Storage: private by default from now on.** Two new private buckets for new
    uploads, folder-scoped and partner-only policies, plus per-bucket size and
    MIME limits. The app resolves a row's URL through one **media resolver**:
    it returns the existing public object for old messages, or a signed URL
    (1-hour, cached ~50 min in memory) for the private copy. `messages` is still
    never written to. *Optional second step, only if you want it: move the old
    objects too and remember `moved_to` in `chat_attachments` — the resolver then
    covers the entire history.*
16. **Close the doors no one needs.** Turn off public sign-up in the Auth
    settings, add a DB guard so `public.users` only ever holds the two known
    accounts, and tighten the remaining `USING (true)` policies to `is_partner`.
17. **Headers and crawlers.** CSP (start report-only, then enforce),
    `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy: no-referrer`,
    `Permissions-Policy` — via `vercel.json`, plus `noindex` on the private
    routes. The decoy portal stays exactly as believable; it just stops being a
    Google result.
18. **Session hygiene.** Shorter access-token life with refresh rotation, a
    **Devices & sessions** screen built on the `user_login_sessions` table with
    "sign out everywhere", and a local PIN (PBKDF2 via SubtleCrypto) or WebAuthn
    lock in front of `/home`, so an unlocked phone is not enough.
19. **Your data, in your hands.** "Export everything" (JSON + media manifest) and
    "Delete everything", plus `scripts/backup.mjs` for a nightly dump to your own
    machine, and a retention rule that trims `llm_usage` / `llm_cache`.
20. **Function hardening sweep + supply chain.** Explicit `verify_jwt = true` in
    `config.toml` for every function, one shared CORS allowlist
    (`myanshika.xyz` + localhost), an `npm audit` triage, and a
    `dependabot.yml`. The AI sticker studio stays lazy and gets a warning that it
    downloads a ~10 MB model.

### P4 — Prove it, so "fast" is a number

21. **`scripts/perf-budget.mjs`** — runs after every build and *fails* if: first
    load > 260 KB gzip, any chunk > 300 KB gzip outside the forest, `public/` >
    5 MB, more than 2 render-blocking font requests, or any `<img>` without lazy
    loading. Wire it into the sweep next to `check-sql`.
22. **`scripts/security-check.mjs`** — greps for regressions that matter:
    `USING (true)`, `public' = true`, edge functions without an auth guard,
    `service_role` in client code, `Allow: /` in robots. Run it with the sweep so
    these cannot quietly come back.
23. **Guide §14 "Fast, light, secure"** — the target sheet (LCP ≤ 2.0 s on a
    throttled 4G phone, ≤ 250 KB gzip first load, ≈ 0 KB repeat visit, CLS ≤ 0.02,
    0 blocking third-party requests), how to measure it on the real domain, and
    the security checklist to re-run after any change.

---

## 2. Order of work

| Step | Phase | Why this order |
| --- | --- | --- |
| 1 | P0 (items 1–4) | Biggest byte win in the shortest time, no user-facing behaviour change, no DB step |
| 2 | P3 items 13–14 | Two live holes closed in two small files |
| 3 | P1 + P2 items 8–11 | The "feels fast and cheap to run" work |
| 4 | P3 items 15–20 | The deeper security work; item 15 needs one decision from you |
| 5 | P2 item 12, P4 | Offline + the guards that keep all of it from regressing |

Every step ends with the same sweep you already know: `check-sql`, inlined-AI
check, LLM tests, vitest, tsc at its baseline, dev-server smoke.

## 3. What I need from you

1. **Start now, or read the plan first?** P0 is safe and reversible and I can do
   it immediately.
2. **The 71 MB of textures that can never load.** Delete them (git history keeps
   them), or keep every file and just re-encode to small WebP, or leave alone?
3. **New media in private buckets with signed links** — for new uploads only, or
   also migrate the existing ones into the private bucket (nothing in `messages`
   is ever rewritten either way)?
4. **Sign-ups and search engines** — shut both completely, or shut sign-ups but
   leave the decoy study portal crawlable so it looks like an ordinary site?

## 4. What this plan will not do

- It will not touch `messages` (read-only, as always) or rewrite history.
- It will not remove any feature you asked for — the forest, the sky, the letters
  and the twin all stay; the forest just stops shipping 71 MB it cannot use.
- It will not put a third-party analytics or CDN in the loop. Keeping the app
  light is done by shipping less, not by sending more.
