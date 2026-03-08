

# Daily Checklist with Calendar History & Productivity Dashboard

## Overview
A daily checklist system where both partners create daily tasks, see each other's progress in real-time, browse past days via a calendar, and track missed/incomplete tasks. Includes a productivity summary widget on the home screen.

## Database

**New table: `daily_checklists`**
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL (references auth.users on delete cascade)
- `title` text NOT NULL
- `is_completed` boolean DEFAULT false
- `checklist_date` date NOT NULL DEFAULT CURRENT_DATE
- `completed_at` timestamptz
- `created_at` timestamptz DEFAULT now()

**RLS (permissive):**
- SELECT: all authenticated (both partners see each other's lists)
- INSERT/UPDATE/DELETE: `auth.uid() = user_id`

**Realtime:** add to `supabase_realtime` publication.

## New Files

### `src/hooks/useDailyChecklist.ts`
- Accepts a `date` parameter (defaults to today)
- Fetches all checklist items for that date (both users)
- CRUD: `addItem(title)`, `toggleItem(id)`, `deleteItem(id)`
- Realtime subscription on `daily_checklists`
- Returns `{ myItems, partnerItems, loading, addItem, toggleItem, deleteItem, myProgress, partnerProgress }`
- Progress = `{ completed: number, total: number }`

### `src/pages/DailyChecklist.tsx`
Three sections in a single scrollable page:

1. **Calendar Navigator** — Uses the existing `Calendar` component (DayPicker) at the top. Dates with checklist data get dot indicators. Selecting a date shows that day's checklists. Today is default.

2. **Dual Checklist View** (for selected date):
   - **"Your Checklist"** — editable (add/check/delete) with a `Progress` bar, motivational text ("3/5 — Keep going!", "5/5 — All done! 🎉")
   - **"Partner's Checklist"** — read-only view with progress bar, shows partner's name

3. **Missed/Incomplete Section** — Shows all incomplete items from past dates (not today), grouped by date. Each item shows the date it was from. Option to "carry forward" an item to today.

**Past dates:** checklist is read-only (no adding/editing). Only today is editable.

### `src/components/home/DailyChecklistWidget.tsx`
- Compact home widget showing today's progress for both partners
- Two mini progress bars side-by-side: "You: 3/5 ✅ | Partner: 2/4 ✅"
- Tapping navigates to `/daily-checklist`

## Modified Files

### `src/App.tsx`
- Add route `/daily-checklist` → `DailyChecklist`

### `src/pages/Home.tsx`
- Add `DailyChecklistWidget` component
- Add "Daily Checklist" to Quick Links grid

## UI Design
- Calendar at top with dot modifiers on days that have data
- Progress bars using existing `Progress` component
- Consistent card styling with the rest of the app (rounded-2xl, border, bg-card)
- Motivational status text changes based on completion percentage
- Missed tasks shown with a red/amber indicator and the original date

## Technical Notes
- The calendar date dots require a separate lightweight query to fetch distinct dates that have checklist entries
- "Carry forward" duplicates the item with today's date
- All queries filter by `checklist_date` for efficient day-based lookups
- Partner detection reuses the existing `usePartner` hook

