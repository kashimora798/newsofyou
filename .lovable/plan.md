# Feature Analysis & Implementation Plan

These are ambitious features. Let me assess each for feasibility in a web app (React/Vite/Supabase) and recommend a phased approach.

## Feature Feasibility Assessment


| Feature                              | Complexity | Web Feasible?                                                         | Priority                |
| ------------------------------------ | ---------- | --------------------------------------------------------------------- | ----------------------- |
| Parallel Universe Mode (theme skins) | Medium     | Yes                                                                   | High — fun, doable      |
| Voice Waves → Art                    | Very High  | Partial — Web Audio API works, but persistent art timeline is complex | Low                     |
| Shared Dream Canvas                  | High       | Yes — HTML Canvas + Supabase realtime                                 | Medium                  |
| Soulmate Clock                       | Low-Medium | Yes — track overlap time in DB                                        | High — elegant & simple |
| Conversation Chapters                | Medium     | Yes — AI/keyword grouping of messages                                 | Medium                  |
| Doodle Reply                         | Medium     | Yes — canvas drawing, save as image                                   | Medium                  |
| Custom Reaction Combos               | Low        | Partially exists already (custom touch reactions)                     | High — extend existing  |


## Recommended Build Order (by impact-to-effort ratio)

### 1. Parallel Universe Mode (Chat Theme Skins)

- Add a `chat_theme` column to `chat_user_settings` (or use existing wallpaper system)
- Create 5-6 theme presets: "Spy Documents" (monospace, redacted look), "GeoCities 98" (comic sans, under-construction gifs, visitor counter), "GameBoy" (green monochrome, pixel font), "Horror ARG" (glitch text, static noise), "Romance Novel" (script font, parchment bg, rose petals)
- Each theme = a CSS class applied to the chat container that overrides fonts, colors, bubble styles, and background
- Theme picker in Settings or as a quick-toggle button in ChatHeader
- Store selection per-user in `chat_user_settings`

### 2. Soulmate Clock

- Track concurrent online time: when both users have `is_online = true`, a Supabase edge function or client-side interval increments a shared counter in a new `couple_stats` table (`concurrent_seconds INTEGER`)
- Client polls every 30s: if both online, increment locally and sync
- Display as a beautiful analog clock component on the Home page showing "time spent together"
- Format as days/hours/minutes

### 3. Custom Reaction Combos (Extend Existing)

- Already have `custom_touch_reactions` table and picker
- Extend to allow custom **message reactions** (not just touch reactions): add a `custom_message_reactions` table with `emoji`, `label`, `animation_type`, `sound_url`
- Show custom reactions in the QuickReactionBar alongside default emojis
- Each custom reaction can trigger a mini CSS animation (bounce, sparkle, shake) on the message bubble

### 4. Doodle Reply

- Add a mini canvas (HTML5 Canvas) overlay triggered from the reply menu
- User draws with finger/mouse, saves as PNG data URL
- Send as a message with `message_type: "doodle"` and the image stored in Supabase Storage
- Render in MessageBubble like an image but with a "✏️ Doodle" label

### 5. Conversation Chapters

- Group messages by date ranges + topic detection (simple keyword matching or AI via edge function)
- Add a "Chapters" view accessible from ChatHeader that shows timeline blocks
- Each chapter = clickable, scrolls to that section in chat
- Bookmarkable chapters stored in a `bookmarked_chapters` table

### 6. Shared Dream Canvas

- A dedicated page (`/canvas`) with an infinite HTML5 Canvas
- Both users can draw, add text, paste images
- Supabase Realtime broadcasts strokes/objects live
- Canvas state persisted as JSON in a `shared_canvas` table
- This is the most complex feature — essentially building a mini collaborative whiteboard

### 7. Voice Waves → Art

- Requires Web Audio API to analyze audio messages and generate waveform visualizations
- Each voice message gets a unique SVG wave pattern rendered alongside the audio player
- A "Sound Gallery" page that stitches all voice wave patterns into a scrollable art timeline
- Most complex, least essential — save for later

## What I'd Build First

I recommend starting with **Parallel Universe Mode** and **Soulmate Clock** — they're the most delightful, most feasible, and most unique. The theme skins transform the entire chat feel instantly, and the Soulmate Clock is a beautiful emotional feature that's technically simple.