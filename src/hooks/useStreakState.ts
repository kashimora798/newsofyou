import { supabase } from "@/integrations/supabase/client";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streakBrokenOn: string | null;
  todayCount: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number): string {
  const d = new Date(dateString + "T00:00:00");
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

/**
 * Efficient streak calculation using DATE-aggregated distinct message days only.
 * Never downloads message content — just dates. Far faster for large datasets.
 */
async function computeStreakFromDates(): Promise<{ brokenOn: string | null; streak: number; longest: number }> {
  // Fetch only the distinct dates of messages — a tiny payload vs full message scan
  const { data } = await supabase
    .from("messages")
    .select("created_at")
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return { brokenOn: null, streak: 0, longest: 0 };

  // Build a set of unique date strings
  const daySet = new Set<string>();
  for (const msg of data) {
    // safe slice: works with both "2026-08-23T..." and "2026-08-23 ..." formats
    daySet.add(msg.created_at.slice(0, 10));
  }

  if (daySet.size === 0) return { brokenOn: null, streak: 0, longest: 0 };

  // Current streak: walk backwards from today
  const today = todayStr();
  let streak = 0;
  const d = new Date(today + "T00:00:00");

  while (true) {
    const ds = dateStr(d);
    if (daySet.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  const brokenOn = dateStr(d);

  // Longest streak from sorted days
  const sorted = Array.from(daySet).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run, streak);

  return { brokenOn, streak, longest };
}

/**
 * Get streak data for a user.
 * 
 * Fast path: if stored streak values are recent enough (lastCountedDay = today or yesterday),
 * just return stored values with a today-count query.
 * 
 * Slow path: only runs when stored data is stale. Fetches distinct message dates only — not
 * full messages — making it efficient even for large datasets.
 */
export async function getStreakData(userId: string): Promise<StreakData> {
  const today = todayStr();

  // Get stored streak info
  const { data: status } = await supabase
    .from("user_status")
    .select("streak_broken_on, current_streak, longest_streak")
    .eq("user_id", userId)
    .single();

  const storedBrokenOn: string | null = (status as any)?.streak_broken_on ?? null;
  const storedStreak: number = (status as any)?.current_streak ?? 0;
  const storedLongest: number = (status as any)?.longest_streak ?? 0;

  // Today's message count (always needed, cheap)
  const todayStart = today + "T00:00:00.000Z";
  const { count: todayCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lt("created_at", today + "T23:59:59.999");
  const tCount = todayCount ?? 0;

  // Case 1: No stored data at all — need to calculate from scratch
  if (!storedBrokenOn && storedStreak === 0) {
    const { brokenOn, streak, longest } = await computeStreakFromDates();
    await supabase
      .from("user_status")
      .update({ streak_broken_on: brokenOn, current_streak: streak, longest_streak: longest } as any)
      .eq("user_id", userId);
    return { currentStreak: streak, longestStreak: longest, streakBrokenOn: brokenOn, todayCount: tCount };
  }

  // lastCountedDay = the last day that was already counted in the stored streak
  const lastCountedDay = addDays(storedBrokenOn!, storedStreak);
  const yesterday = addDays(today, -1);

  // Case 2: Already up to date for today
  if (lastCountedDay === today) {
    return { currentStreak: storedStreak, longestStreak: storedLongest, streakBrokenOn: storedBrokenOn, todayCount: tCount };
  }

  // Case 3: Only yesterday was the last counted day — simple single-day check
  if (lastCountedDay === yesterday) {
    if (tCount > 0) {
      const newStreak = storedStreak + 1;
      const newLongest = Math.max(storedLongest, newStreak);
      await supabase
        .from("user_status")
        .update({ current_streak: newStreak, longest_streak: newLongest } as any)
        .eq("user_id", userId);
      return { currentStreak: newStreak, longestStreak: newLongest, streakBrokenOn: storedBrokenOn, todayCount: tCount };
    }
    return { currentStreak: storedStreak, longestStreak: storedLongest, streakBrokenOn: storedBrokenOn, todayCount: 0 };
  }

  // Case 4: Multiple days have passed — data is significantly stale.
  // Recalculate from scratch using efficient date-only approach.
  const { brokenOn, streak, longest } = await computeStreakFromDates();
  await supabase
    .from("user_status")
    .update({ streak_broken_on: brokenOn, current_streak: streak, longest_streak: longest } as any)
    .eq("user_id", userId);
  return { currentStreak: streak, longestStreak: longest, streakBrokenOn: brokenOn, todayCount: tCount };
}

export async function forceRecalculateStreak(userId: string): Promise<StreakData> {
  const { brokenOn, streak, longest } = await computeStreakFromDates();
  await supabase
    .from("user_status")
    .update({ streak_broken_on: brokenOn, current_streak: streak, longest_streak: longest } as any)
    .eq("user_id", userId);

  const today = todayStr();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lt("created_at", today + "T23:59:59.999");

  return { currentStreak: streak, longestStreak: longest, streakBrokenOn: brokenOn, todayCount: count ?? 0 };
}
