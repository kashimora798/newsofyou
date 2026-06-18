# Games Lobby Revamp + 30-Second Games + "I'm Bored" Launcher — Plan

Ordered **easiest → most complex**. Grounded in the existing engine so we reuse, not rebuild.

## What already exists (reuse, don't rebuild)
- `game_sessions` table: `id, game_type, created_by, opponent_id, status(pending|active|completed|declined), winner_id, board_state, current_turn, timestamps`.
- `useGameSessions` hook: `createGame, acceptGame, declineGame, makeMove, **deleteGame** (exists, unused!), refetch` + derived `pendingInvites / outgoingInvites / activeGames / recentGames`.
- **Live-duel engine**: `useDuelMatch` + `DuelShell` (header, live score bar, connecting state, rounds, game-over celebration). Powers the 6 "⚡" games.
- 11 games today: TicTacToe, WordChain, Hangman, Bingo, QuickDraw (turn-based) · TapDuel, MathSprint, ColorClash, QuizBuzzer, MemoryRace, EmojiRiddle (live 30-sec).
- Apple UI tokens already in the app (`glass`, `tappable`, `ease-spring`, squircle radii, hairlines, `animate-apple-*`).

## The 4 problems to fix
1. **Messy** — one flat list, no categories, generic cards.
2. **Incomplete games shown** — abandoned/stale sessions stay "active" forever and clutter the lobby.
3. **Can't delete** — `deleteGame` is never surfaced.
4. **Not resumable** — resume path needs verifying/fixing per game.

---

> **Status:** Phase A ✅ done · Phase B ✅ done · Phase C/D pending.
>
> Phase A shipped: `gameCatalog.ts` (single source of truth), sectioned Apple lobby
> (⚡ 30-Second / ♟️ Classic grids), swipe-to-delete `ActiveGameCard`, stale-session
> hiding + expired-invite cleanup in `useGameSessions`, grouped recent list + empty states.
>
> Phase B shipped: `ai-game` edge function (OpenRouter free-model fallback) + `lib/aiGame.ts`
> (fail-open client), **Word Chain real-word AI validation**, **Quick Draw Apple UI** pass.
> Audited Hangman — already AI-enhanced (hints + fuzzy guessing), left as-is. AI **degrades
> gracefully**: if `ai-game` isn't deployed, Word Chain still accepts words.
> ⚠️ To activate AI: deploy `supabase/functions/ai-game` and set `OPENROUTER_API_KEY`.

## Phase A — Lobby redesign + cleanup (Apple UI) 🟢 *do first, no new game logic*

**A1. Categorized, sectioned lobby** (`Games.tsx`)
- Large-title header in a `.material-regular` bar; single accent; generous spacing.
- Sections with Apple grouped-list section labels:
  - **⚡ 30-Second Games** — the live duels (Tap Duel, Color Clash, Math Sprint, Quiz Buzzer, Memory Race, Emoji Riddle) + new ones from Phase C.
  - **♟️ Classic & Turn-Based** — Tic Tac Toe, Word Chain, Hangman, Bingo, Quick Draw.
- Game cards → squircle tiles (`--radius-lg`), icon in a tinted square, title + one-line subtitle, `tappable` press feedback, hairline separators. Consider a 2-col grid for quick games, list rows for classics.
- Per-game metadata table (`src/lib/gameCatalog.ts`): `{ type, label, icon, blurb, category, avgSeconds, status: 'ready'|'beta' }` — single source of truth used by lobby + ActiveGameCard + launcher.

**A2. Swipe-to-delete + resume for active sessions** (`ActiveGameCard.tsx` + `Games.tsx`)
- Wire the existing `deleteGame`. iOS-style swipe-left reveals a red **Delete**; tap-to-resume stays.
- Add a small "End game" affordance inside a session too.
- Confirm resume opens each game at its in-progress `board_state` (verify in Phase B).

**A3. Auto-hide / archive stale sessions** (`useGameSessions.ts`)
- Treat as stale: `status='active'` with `updated_at` older than ~30 min, or live-duel sessions that never finished. Either filter them out of `activeGames` (show under a collapsible "Abandoned" group with a Delete-all) or auto-mark `declined`/`completed`.
- Expire old `pending` invites (e.g. > 1 h) so the lobby self-cleans.

**A4. Recent games + empty states**
- Recent as a compact grouped list (W/L/D pills, relative time).
- Friendly empty state when no partner / no games.

**Deliverable:** a clean, sectioned, Apple-styled lobby where you can resume, swipe-delete, and stale junk disappears. No game rules touched yet.

---

## Phase B — Audit & fix the 11 existing games 🟡

- Verification pass (manual + the `verify`/`run` skill): start each game type, play a few moves, **resume** mid-game, finish, rematch.
- For each: mark `ready` or `beta` in `gameCatalog.ts`. **Broken/incomplete games are hidden** (not deleted) until fixed, so the lobby only shows working games — directly addresses "incomplete games all shown."
- Fix the cheap breakages found; file the deeper ones as follow-ups.

---

## Phase C — New 30-Second games 🟡→🟠 *(build a few per batch; each reuses an engine)*

### Two reusable engines now exist
- **`useDuelMatch` + `DuelShell`** — *first-to-claim / speed* games (Tap Duel, Math Sprint, Emoji Reflex, Odd One Out). Round → countdown → fastest-correct claims → reveal.
- **`useSimulMatch` + `SimulShell`** — *simultaneous secret-pick / compatibility* games (This or That, and next: Number Ninja, Mood Match, Secret Assumptions, Would You Rather). Each player answers secretly → both reveal → per-round `resolveRound` → custom summary (`renderSummary`).

**Adding a new game = one component file + register in 3 spots** (`gameCatalog.ts`, `createGame` live board_state, `Games.tsx` switch).

To add a simul game: call `useSimulMatch<RoundData, Answer>({ makeRound, resolveRound, decideWinner })`,
render the answering/reveal UI as `SimulShell` children, and optionally pass `renderSummary`.
`resolveRound(data, mine, theirs)` returns `{ meScore, oppScore, ...extras }` from the caller's
own perspective (must be symmetric). `decideWinner` → `null` for "win together" compatibility games.

Priority (from your Top-10, not already covered):
- ✅ **Emoji Reflex** (#2) — tap the matching emoji fastest; grid grows in later rounds. Reuses DuelShell. *(done)*
- ✅ **Odd One Out** (#10) — spot what doesn't belong, fastest correct wins; shows "why" on reveal. Reuses DuelShell. *(done)*
1. **This or That: Rapid Fire** (#26) 🟡 — N simultaneous either/or prompts; end-screen "compatibility %". (Needs custom simultaneous sync, not the first-to-claim engine.)
2. **Number Ninja** (#4) 🟡 — both secretly pick 1–10, closest to a secret magic number wins; best of 3.
3. **Hot or Cold** (#5) 🟢 — one sets 1–100, other guesses with 🥶🌡️🔥❤️‍🔥 feedback; fewest guesses wins.
4. **The Silence Test** (#37) 🟢 — both "ready"; first to send anything loses; tension meter.
5. **Spin the Wheel** (#31) 🟡 — dare/truth/compliment/roast/mini-game; pure chaos.
6. **Mini Wordle Duel** (#21) 🟠 — same 5-letter word, race in fewest guesses.

> Two new live games shipped (Emoji Reflex, Odd One Out). Registered in `gameCatalog`,
> `createGame` board_state, and the `Games.tsx` switch. Both appear under ⚡ 30-Second Games.

Deferred (need AI scoring / images / heavier state): Word Blurt, Caption This, Wrong Answers Only, Anagram, Crossword, Connect-4 Speed, Minesweeper Duel, Sudoku, personality rounds — revisit after the core set lands.

**Shared scoring/progression** (optional, from your spec): points per result, rank tiers (Rookie→Legend). Store on a `game_profiles`/stats row or derive from `recentGames`. Keep optional so it doesn't block the games themselves.

---

## Phase D — "I'm Bored" → random game launcher 🟠

- Replace the current `i'm bored` mapping (coin/dice/8-ball) in `secretCommands.ts`.
- New flow: `i'm bored` → **spin-the-wheel overlay** cycling quick-game names (2s) → lands on a random `ready` 30-sec game → `createGame(partner, type)` → deep-link into it.
- Bridge chat→games: navigate to `/games?play=<sessionId>` (or a shared "pending intent") so the Games page opens that session directly; partner gets the invite / auto-join when online.
- "Play Again? / Different Game / Back to Chat" on the game-over screen (DuelShell already has rematch + exit; add "different game" = re-spin).

---

## Suggested build order
1. **Sprint 1:** Phase A (A1–A4) — the redesign + delete + stale-cleanup. Biggest visible win.
2. **Sprint 2:** Phase B — audit, hide broken, fix cheap ones.
3. **Sprint 3:** Phase C batch 1 — This or That, Number Ninja, Hot or Cold, Silence Test.
4. **Sprint 4:** Phase C batch 2 — Emoji Reflex, Spin the Wheel, Mini Wordle.
5. **Sprint 5:** Phase D — "i'm bored" wheel launcher + chat→games bridge.

## Open question (assumed, tell me if wrong)
"User can delete the incomplete games" → interpreted as **(a)** add swipe-to-delete for abandoned game *sessions* + auto-hide stale ones (Phase A), **and (b)** hide broken game *types* from the lobby until fixed (Phase B). If you instead meant "permanently remove specific games from the app," tell me which.
