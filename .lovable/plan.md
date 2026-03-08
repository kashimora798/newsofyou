

# 12 New Creative Achievements

These achievements leverage existing app features (games, bookmarks, reactions, reminders, calendar, daily checklist, compliments, scheduled messages, stickers, GIFs, letters) to create meaningful, surprising unlocks.

## New Achievements

| # | ID | Name | Icon | Tier | Category | Condition | Unlocked Text |
|---|-----|------|------|------|----------|-----------|---------------|
| 1 | `gameon` | Game On! | 🎮 | Bronze | Features | Complete 1 game session | "Your first game together! Whether you won or lost doesn't matter — you played. And that's everything. 🎮✨" |
| 2 | `archrival` | Arch Rival | 🏅 | Gold | Features | Complete 25 game sessions | "25 games played together. At this point you probably know each other's strategies better than your own. 🏅🔥" |
| 3 | `bookmark10` | Memory Keeper | 🔖 | Silver | Features | Bookmark 10 messages | "10 messages saved. These are the lines you never want to forget. Your personal highlight reel. 🔖💛" |
| 4 | `react50` | Reaction King | 👑 | Bronze | Love | React to 50 messages | "50 reactions! Sometimes a ❤️ says more than a thousand words. 👑" |
| 5 | `checklist7` | Routine Masters | ✅ | Silver | Streaks | Complete all checklist items 7 days in a row | "7 perfect checklist days in a row. You don't just talk — you DO. Together. ✅🔥" |
| 6 | `reminder25` | Never Forget | 🔔 | Bronze | Features | Create 25 reminders | "25 reminders set. Because every moment with them is worth remembering. 🔔💜" |
| 7 | `calendar10` | Date Planner | 📅 | Silver | Features | Create 10 shared calendar events | "10 events planned together. Your future is literally on the calendar. 📅💫" |
| 8 | `gifmaster` | GIF Master | 🎬 | Bronze | Media | Send 50 GIFs | "50 GIFs sent! When words fail, animations speak. You've mastered the art of visual conversation. 🎬😂" |
| 9 | `stickerfiend` | Sticker Fiend | 🎨 | Bronze | Media | Send 30 stickers | "30 stickers sent. Your chat is basically an art gallery at this point. 🎨✨" |
| 10 | `sweetnothings` | Sweet Nothings | 🍬 | Silver | Love | Send/receive 50 compliments | "50 compliments exchanged. In a world full of critics, you chose to be each other's biggest fan. 🍬💕" |
| 11 | `futurethinker` | Future Thinker | 🚀 | Silver | Features | Schedule 10 messages | "10 messages sent to the future. You plan your words like you plan your love — intentionally. 🚀💌" |
| 12 | `midnightgamer` | Midnight Gamers | 🌃 | Gold | Secret | Play a game between midnight and 4 AM | "A game at 3 AM? Sleep is optional when you're having this much fun together. 🌃🎮" |

## Technical Changes

### 1. Update `get_achievement_stats` SQL function
Add new stat queries to the existing function:

```sql
'bookmark_count': SELECT COUNT(*) FROM bookmarks WHERE user_id = auth.uid()
'reaction_count': SELECT COUNT(*) FROM message_reactions WHERE user_id = auth.uid()
'gif_count': SELECT COUNT(*) FROM messages WHERE message_type = 'gif'
'sticker_count': SELECT COUNT(*) FROM messages WHERE message_type = 'sticker'
'compliment_count': SELECT COUNT(*) FROM compliments
'reminder_count': SELECT COUNT(*) FROM reminders
'event_count': SELECT COUNT(*) FROM shared_events
'scheduled_count': SELECT COUNT(*) FROM messages WHERE scheduled_at IS NOT NULL
'game_completed_count': SELECT COUNT(*) FROM game_sessions WHERE status = 'completed'
'midnight_game': check game_sessions for games active between 0-4 AM
'checklist_perfect_streak': count consecutive days with 100% completion
```

### 2. Update `src/pages/Achievements.tsx`
Add the 12 new achievement entries to the `list` array using the new stats from the updated RPC function.

### 3. Update `src/hooks/useSecretAchievements.ts`
Add `event_midnightgamer` flag detection for the secret midnight gaming achievement — triggered when a game move is made between 12-4 AM.

### Files Modified
| File | Change |
|------|--------|
| New migration SQL | Update `get_achievement_stats` with new queries |
| `src/pages/Achievements.tsx` | Add 12 new achievement definitions |
| `src/hooks/useSecretAchievements.ts` | Add midnight gamer check |

