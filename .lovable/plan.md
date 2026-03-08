

# Bingo Game

## Overview

A 1v1 Bingo game where both players prepare their own board with numbers (1 to N²), then take turns calling numbers. The first player to complete N lines (rows, columns, diagonals) wins.

## Game Flow

```text
1. Creator picks grid size (5×5, 6×6, or custom N×N)
2. Both players fill their boards (manual or "Random Fill" button)
3. No duplicates allowed — each number 1 to N² used exactly once
4. Once both boards are ready → game starts
5. Players alternate turns calling a number (1–N²)
6. Both boards auto-mark that number if present
7. First to complete N lines (rows + cols + diagonals) wins
```

## Board State (JSONB)

```json
{
  "gridSize": 5,
  "phase": "setup" | "playing" | "won",
  "boards": {
    "<userId1>": [3, 17, 8, ...],   // N² numbers in order
    "<userId2>": [12, 1, 25, ...]
  },
  "calledNumbers": [7, 14, 3, ...],
  "readyPlayers": ["<userId1>"],
  "linesToWin": 5
}
```

## New File

**`src/components/games/Bingo.tsx`** — Full Bingo component with:
- **Setup phase**: Grid size selector (5/6/custom), number placement grid, "Random Fill" button, "Ready" button
- **Playing phase**: Own board (with marks), called numbers list, number picker for calling, turn indicator
- **Win detection**: Count completed lines (rows, cols, both diagonals) per player; first to reach N lines wins
- **Real-time sync** via existing `makeMove` pattern

## Modified Files

| File | Change |
|------|--------|
| `src/pages/Games.tsx` | Add Bingo to available games, route to Bingo component |
| `src/hooks/useGameSessions.ts` | Add bingo initial state in `createGame` |

## Win Detection Logic

For an N×N grid, check:
- N rows, N columns, 2 diagonals = 2N+2 possible lines
- Count how many are fully marked on a player's board
- First player to reach N completed lines wins

## Technical Details

- Grid size chosen by game creator, stored in `board_state.gridSize`
- Both players arrange numbers independently during setup phase
- Random fill: Fisher-Yates shuffle of [1..N²]
- Called numbers tracked in shared array — both boards mark automatically
- Uses existing `onMakeMove` prop pattern for Supabase updates
- No DB schema changes needed — uses existing `board_state` JSONB field

