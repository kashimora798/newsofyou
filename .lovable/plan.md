

## Plan: Role-Based Chat Interface (Partner vs Demo)

### What This Does
Add a `role` column to the `user_status` table. Users with role `"partner"` see the full chat app as-is. Users without that role (or with role `"demo"`) see a dummy chat interface with sample/test messages and limited functionality -- they can explore the UI but aren't connected to real chat data.

### Technical Steps

**1. Database Migration**
- Add `role` column to `user_status` table: `text NOT NULL DEFAULT 'demo'`
- Existing users (the two partners) will need their role updated to `'partner'` via an insert/update query

**2. Create `useUserRole` Hook**
- New hook `src/hooks/useUserRole.ts`
- Fetches the `role` from `user_status` for the current user
- Returns `{ role, loading }` -- either `"partner"` or `"demo"`

**3. Create Dummy Chat Page**
- New page `src/pages/DemoChat.tsx`
- Static/mock chat UI with hardcoded sample messages (fun test conversations)
- Same visual style as real Chat but no Supabase connection
- Read-only or local-only input (messages stay in local state, never sent to DB)
- A banner at top: "Demo Mode -- You're exploring a preview"

**4. Update Routing Logic**
- In `src/pages/Chat.tsx`: after auth check, fetch user role
  - If `role === "partner"` -> render `ChatView` (existing behavior)
  - If `role !== "partner"` -> render `DemoChat`
- Same check in `src/pages/Home.tsx` to show appropriate dashboard (full vs limited)

**5. Files Changed**
| File | Change |
|------|--------|
| Migration SQL | Add `role` column to `user_status` |
| `src/hooks/useUserRole.ts` | New hook |
| `src/pages/DemoChat.tsx` | New dummy chat page |
| `src/pages/Chat.tsx` | Role check to route to real vs demo chat |

