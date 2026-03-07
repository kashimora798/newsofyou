# Creative & Useful Features for a Two-Person App

Here's a curated list of features organized by category, ranked by impact and feasibility:

---

## Productivity & Organization

1. **Shared & Private To-Do Lists** — A tabbed list view where both partners can add, check off, and assign tasks. Toggle between "Shared" (groceries, chores, trip planning) and "Private" (personal reminders only you see). Items can have due dates, priority, and assignment.
2. **Reminders & Nudges** — Schedule reminders that notify your partner at a specific time ("Pick up milk at 6pm", "Call the dentist"). Can also be self-reminders. Shows as a special message in chat when triggered.
3. **"Remember This" Bookmarks** — Long-press any message in chat to bookmark it into a searchable collection. Categories like "Restaurants to try", "Gift ideas", "Important dates", "Funny moments". A dedicated page to browse saved items.

---

## Planning & Calendar

8. **Shared Calendar & Countdowns** — Mark important dates (anniversaries, trips, events). Home screen shows countdown widgets to the next event. Integrates with reminders.
9. **Bucket List** — A shared list of experiences to have together. Check them off with photos/notes when completed. Categories: Travel, Food, Adventures, Goals.
10. &nbsp;
11. Memory & Fun

11. **Photo Timeline** — A shared photo album organized chronologically. Upload photos together, add captions. "On This Day" feature shows photos from past years.
12. **Shared Music/Movie Lists** — "Watch together" and "Listen together" lists. Rate items after experiencing them. Recommendation suggestions based on shared tastes.
13. **Secret Compliment Box** — Write compliments that get delivered at random times throughout the week. Partner never knows when one will pop up.

---

## Recommended Build Order (Best ROI)


| Priority | Feature                      | Why                                             |
| -------- | ---------------------------- | ----------------------------------------------- |
| 1        | Shared & Private To-Do Lists | Most universally useful, daily engagement       |
| 2        | "Remember This" Bookmarks    | Leverages existing chat, low effort, high value |
| 3        | Reminders & Nudges           | Practical daily utility                         |
| 4        | Mood Check-In                | Emotional connection, beautiful UI potential    |
| 5        | Gratitude Jar                | Unique, heartfelt, grows over time              |
| 6        | Shared Calendar & Countdowns | Planning utility                                |


All features use Supabase tables with RLS, real-time sync between partners, and fit naturally into the existing app structure (Home widgets + dedicated pages + BottomNav).