# Chat upgrade — speed, albums, emoji, GIFs, streak fix

## Do these two things after merging
1. **Streak fix (SQL)** — run `supabase/migrations/20261101000000_streak_message_days.sql`
   in the Supabase SQL editor (or `supabase db push`). The app also works without it
   (falls back to paging through messages), the SQL function just makes it instant.
2. **GIFs** — add a free GIPHY key: `VITE_GIPHY_API_KEY=...` in `.env`, **or** paste it into
   `src/config/apiKeys.ts` (single file for all third-party keys).

No login / auth code was touched. Same Supabase project, no new tables or columns.

## What changed
| Area | Change |
|---|---|
| **Streak bug (stuck at 56)** | Root cause: PostgREST returns max 1000 rows per query, so only the newest ~1000 messages (≈56 days) were ever counted. Now: distinct-day SQL function (+ paginated fallback), local-timezone dates (was UTC), stale cached value no longer trusted, streak stays alive until midnight. |
| **Speed** | Optimistic sends (message shows instantly, clock → ticks), composer clears instantly, post-send side effects moved off the critical path, memoised message rows with stable callbacks, incremental reactions fetch + one realtime channel (was refetch-all + resubscribe per message), emoji data lazy-loaded (82 kB gz, only when opened), `lte` + dedupe pagination, light GIF renditions + WebP previews. |
| **Photo albums** | Pick/paste/drag many photos → preview tray → sent together, stacked in one WhatsApp-style grid (2 / 3 / 4 / "+N"). Parallel compressed uploads, one DB insert. Swipeable gallery lightbox (arrows / swipe / keys). Stored as normal `image` rows tagged in `messages.emoji` JSON → old clients still work. |
| **Emoji** | New lightweight picker: bottom category bar, search, recents, skin tones, inserts at the caret. Emoji-only messages (1–3) render jumbo without a bubble. |
| **GIFs** | Masonry grid, Trending / Recent / Saved(♥), related-search chips, infinite scroll, request cancel + cache, key from `src/config/apiKeys.ts`. |
| **UI** | Segmented pill tabs, softer bubbles, glow-focus composer, photo tray, drag-and-drop highlight, draft kept across reloads. |

## Tests
`npm test` — streak maths (incl. the >56-day regression), album grouping, jumbo-emoji detection.
