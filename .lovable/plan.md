

# Game Lobby + Tic Tac Toe

## Overview

Add a full game system: a Game Lobby page with game invites, and a real-time Tic Tac Toe game — both synced via Supabase Realtime so both partners play live.

## Database

Two new tables (via migration):

**`game_sessions`** — tracks each game instance
- `id` (uuid, PK)
- `game_type` (text — 'tic_tac_toe', extensible for future games)
- `created_by` (uuid, FK → auth.users)
- `opponent_id` (uuid, FK → auth.users)
- `status` (text — 'pending', 'active', 'completed', 'declined')
- `winner_id` (uuid, nullable)
- `board_state` (jsonb — stores game-specific state, e.g. 9-cell array for TTT)
- `current_turn` (uuid — whose turn it is)
- `created_at`, `updated_at` (timestamptz)

RLS: Both players can read/update their own games. Insert for authenticated users.

## New Files

| File | Purpose |
|------|---------|
| `src/pages/Games.tsx` | Game Lobby — shows available games, pending invites, active/past games |
| `src/components/games/GameLobbyCard.tsx` | Card for each game type (icon, name, "Challenge" button) |
| `src/components/games/GameInvite.tsx` | Incoming/outgoing invite cards with Accept/Decline |
| `src/components/games/ActiveGameCard.tsx` | Resume an active game |
| `src/components/games/TicTacToe.tsx` | Full Tic Tac Toe board with real-time moves via Supabase Realtime |
| `src/hooks/useGameSessions.ts` | CRUD + realtime subscription for game_sessions |

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/games` route |
| `src/pages/Home.tsx` | Add "Games" to quickLinks |
| `src/components/layout/BottomNav.tsx` | Add Games tab (Gamepad2 icon) |

## Game Lobby Page Design

- Header with "Game Lobby" title and partner avatar
- **Incoming Invites** section — glassmorphic cards with Accept/Decline buttons, pulsing animation
- **Available Games** section — grid of game cards (Tic Tac Toe first, placeholders for future games like Word Chain, Quiz, etc.)
- **Recent Games** section — past completed games showing winner/result
- All styled with existing glass aesthetic and framer-motion stagger animations

## Tic Tac Toe Game

- 3x3 grid, glassmorphic cells
- X/O rendered as animated SVGs with spring entrance
- Turn indicator showing partner's name/avatar
- Win detection with celebration animation (confetti-style)
- Draw detection
- Real-time sync: moves written to `board_state` jsonb, opponent sees updates via Supabase Realtime channel
- "Play Again" and "Back to Lobby" buttons on game end

## Flow

```text
Home → Games (lobby)
  ├── See available games (Tic Tac Toe card)
  ├── Tap "Challenge" → creates game_session (status: pending)
  ├── Partner sees invite → taps Accept → status: active
  ├── Both see the board → take turns updating board_state
  └── Win/Draw → status: completed, show result
```

## Technical Details

- Board state stored as JSON array: `["X","","O","","X","","","","O"]`
- Moves update via `supabase.from('game_sessions').update({ board_state, current_turn })`
- Realtime subscription on `game_sessions` table filtered by session id
- Win check runs client-side after each move
- Creator is always X, opponent is always O

