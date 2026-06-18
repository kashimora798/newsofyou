# Secret Features & Mini-Games — Build Roadmap

Ordered **easiest → most complex**. Most features plug into ~4 shared systems built in Phase 0.
Difficulty: 🟢 trivial · 🟡 moderate · 🟠 hard · 🔴 complex (multiplayer state).

---

## Phase 0 — Shared foundations (build once, everything plugs in)

These are not user-facing features; they're the rails. Doing them first makes every later item a small addition.

1. **Command router** (`src/lib/secretCommands.ts` + hook into `handleSend`)
   - Intercept outgoing text in `Chat.tsx → handleSend`. If it's a `/command` or a known trigger phrase, fire an effect **instead of / in addition to** sending.
   - Reuses the existing `detectEffect` idea, generalized to also handle slash commands and "both-screen" events.

2. **Effect overlay registry** (`src/components/secrets/SecretOverlayHost.tsx`)
   - One mounted host that renders any full-screen animation by id (`portal`, `rain`, `scratch-card`, `coin-flip`, …). Clone the `TouchReactionOverlay` structure.
   - Local trigger + queue trigger both go through this.

3. **Realtime "fun event" channel** (extend `pending_animations` or a Supabase broadcast channel)
   - Generalize the existing `keyword_effect` insert so any secret event (`mystery_box`, `rain`, `mirror`, `lucky_number`) reaches the partner's `SecretOverlayHost`. `useAnimationQueue` already polls/subscribes — extend its switch.

4. **Gesture layer** (`src/hooks/useChatGestures.ts` + invisible capture overlay)
   - Multi-touch / pointer recognizer over the chat area: circle-draw, pull-down-hold, three-finger tap, two-finger spin. Built last within "foundations" but before the gesture-driven features.

---

## Phase 1 — Text & slash-command triggers 🟢 (reuse `detectEffect` + router)

Single-screen first; the synced versions come in Phase 3.

- ✅ **`/flip` coin flip** — 3D CSS coin, result synced to both screens, persistent result bubble. *(done)*
- ✅ **`/dice` dice roll** — 3D CSS pip cube, result synced to both screens, persistent result bubble. *(done)*
- ✅ **`/8ball` magic 8-ball** — shaking ball, classic answers, synced + persistent bubble. *(done)*
- ✅ **`/rps` rock-paper-scissors** — throw picker → shake → reveal vs. fate, win/lose/draw synced. *(done)*
- ✅ **`/lucky` lucky number** — slot-machine reveal; if it matches partner's last number → MATCH bonus + sparkle. *(done)*
- ✅ **`are you there?`** → "Yes, always 💕" + heartbeat pulse (both screens). *(done)*
- ✅ **`good morning ☀️`** → sunrise + rays + flying birds + synthesized chime. *(done)*
- ✅ **`good night 🌙`** → twinkling stars, moon, dim gradient + synthesized lullaby. *(done)*
- ✅ **`sorry`** → broken heart pieces back together (mending-heart overlay). *(done)*
- ✅ **`i'm angry 😤`** → fire emoji rain 🔥 + shake + red vignette. *(done)*
- ✅ **`same`** → mirror animation (both screens). *(done)*
- ✅ **`surprise me`** → randomly fires one of the other overlays. *(done)*
- ✅ **`i'm bored`** → random mini-game (coin / dice / 8-ball) pops up. *(done)*

**🎉 PHASE 1 COMPLETE.**

**Foundations built:** `SecretOverlayHost` registry (Phase 0.2) routes every full-screen effect
through one piece of Chat state — new effects just register a case. `secretSounds.ts` provides
Web-Audio chimes/melodies (no downloaded assets). Sync uses the existing message stream (online
partner) + `pending_animations` `secret_event` (offline). Audio is synthesized in-browser.

*All of the above = new entries in a command/trigger table + a small overlay each. No new infra.*

---

## Phase 2 — Tap easter eggs + persistent counters ✅ COMPLETE

- ✅ **Tap chat header 3× → fortune cookie** — triple-tap on the name area cracks a cookie open with a slip-paper fortune (single tap still opens profile). *(done)*
- ✅ **Double-tap empty chat area → scratch card** — canvas scratch-to-reveal (drag finger to uncover) a random love quote. *(done)*
- ✅ **Secret Garden** (`/garden`) — full page at `/garden`; flower counts derived from message history via cheap head-count queries (no new table). Different words → different flowers, with a live garden bed. *(done)*
- ✅ **Mystery Prize every 50th message** — total count checked on send; on each multiple of 50, a tap-to-open gift box reveals a prize, synced to the partner in realtime. *(done)*
- ✅ **"Name all planets in order" → galaxy theme** — sequence detector unlocks + switches to a new starfield `theme-galaxy` chat skin, persisted to settings. *(done)*

**Realtime upgrade:** `useAnimationQueue` now subscribes to `pending_animations` INSERTs, so
synced secret events / mystery prizes reach an already-open partner instantly (not just on
next mount).

---

## Phase 3 — Two-screen synced reactions 🟡 (reuse fun-event channel)

Take Phase 1/2 effects and make them land on **both** screens via the realtime channel.

- 🟡 **`miss you` → rain on both screens** + sad music.
- 🟡 **`guess what` → partner gets a mystery box** they tap to open (reveals your next message / a surprise).
- 🟡 **`same` → mirror on both screens** simultaneously.
- 🟡 **`/lucky` match** — both assigned numbers; if equal → shared bonus surprise overlay.
- 🟡 **Mood Match** — both secretly pick an emoji; reveal simultaneously; match → celebration. *(borderline Phase 5 — needs paired state)*

---

## Phase 4 — Nicknames & ambient personalization 🟡

- 🟡 **Nicknames with effects** — DB fields for partner nickname + effect flag; glowing/flashing render in `ChatHeader`/bubbles on special days (anniversary, birthday). Ties into your existing date/anniversary logic.

---

## Phase 5 — Advanced gestures 🟠 (needs Phase 0.4 gesture layer)

- 🟠 **Circle-draw → magic portal** showing a random saved photo together. (Gesture recognition + portal overlay + random photo from `chat-images`.)
- 🟠 **Pull-down + hold 5s → VCR rewind** to Day 1 conversation. (Hold detector + a "rewind" scrubber that loads the oldest messages with a VCR visual.)
- 🟠 **Three-finger tap → hidden doodle canvas** — quick drawing → send as image (reuses image upload + send path).
- 🟠 **Two-finger spin → secret roulette** of couple challenges. (Rotation gesture + spinning wheel overlay + challenge list.)

---

## Phase 6 — Interactive multiplayer games 🔴 (turn state + realtime sync)

Most complex: need a shared game-session table, turn ownership, and realtime sync. Build a small **game-session framework** first, then each game is a board on top.

- 🔴 **This or That / Would You Rather** — simultaneous answer, then reveal. (Simplest multiplayer — start here.)
- 🔴 **Truth or Dare** — turn-based card draw, takes turns.
- 🔴 **20 Questions** — one sets a secret, other asks/guesses; yes/no tracking.
- 🔴 **Draw & Guess (mini Pictionary)** — one draws on a synced canvas (realtime strokes), other guesses in chat. (Hardest: live canvas streaming.)

---

## Suggested build order (concrete sprints)

1. **Sprint 1 — Foundations:** Phase 0.1 (router), 0.2 (overlay host), 0.3 (fun-event channel).
2. **Sprint 2 — Quick wins:** all of Phase 1 (slash commands + text triggers, single-screen).
3. **Sprint 3 — Easter eggs:** Phase 2 (header taps, scratch card, garden, mystery prize, galaxy).
4. **Sprint 4 — Make it shared:** Phase 3 (sync effects to both screens) + Phase 4 (nicknames).
5. **Sprint 5 — Gestures:** Phase 0.4 gesture layer + Phase 5 features.
6. **Sprint 6 — Games:** game-session framework + Phase 6 games (This-or-That → Truth/Dare → 20Q → Draw&Guess).

## Reuse map
| Need | Already exists |
|---|---|
| Keyword → effect | `detectEffect` / `KEYWORD_MAP` in `MessageEffects.tsx` |
| Cross-screen trigger | `pending_animations` + `useAnimationQueue` |
| Full-screen overlay | `TouchReactionOverlay` pattern |
| Device gestures | `useShakeDetection` |
| Send image (doodle) | `handleFileUpload` / `image_url` path in `MessageInput` |
| Message count | `get_chat_stats` RPC |
| Theme unlocks | theme-skin classes in `index.css` |
| Games home | `Games.tsx` lobby |
