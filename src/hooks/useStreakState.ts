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

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

/**
 * One-time full scan to find streak_broken_on date.
 * Scans backwards from today to find the first gap day.
 */
async function findStreakBreakDate(): Promise<{ brokenOn: string | null; streak: number; longest: number }> {
  const { data: messages } = await supabase
    .from("messages")
    .select("created_at")
    .order("created_at", { ascending: false });

  const daySet = new Set<string>();
  if (messages) {
    for (const msg of messages) {
      daySet.add(msg.created_at.slice(0, 10));
    }
  }

  if (daySet.size === 0) return { brokenOn: null, streak: 0, longest: 0 };

  const today = todayStr();
  // Current streak: go backwards from today
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let brokenOn: string | null = null;

  while (true) {
    const dateStr = d.toISOString().slice(0, 10);
    if (daySet.has(dateStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      brokenOn = dateStr;
      break;
    }
  }

  // Longest streak
  const sorted = Array.from(daySet).sort();
  let longest = 0;
  let temp = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
      temp++;
    } else {
      longest = Math.max(longest, temp);
      temp = 1;
    }
  }
  longest = Math.max(longest, temp);

  return { brokenOn, streak, longest };
}

/**
 * Main entry: get streak data from user_status columns.
 * If columns are empty (first time), does a one-time full scan and stores results.
 * On subsequent calls, just checks if today has messages and updates streak accordingly.
 */
export async function getStreakData(userId: string): Promise<StreakData> {
  const today = todayStr();

  // Get stored streak data from user_status
  const { data: status } = await supabase
    .from("user_status")
    .select("streak_broken_on, current_streak, longest_streak" as any)
    .eq("user_id", userId)
    .single();

  const storedBrokenOn = (status as any)?.streak_broken_on ?? null;
  const storedStreak = (status as any)?.current_streak ?? 0;
  const storedLongest = (status as any)?.longest_streak ?? 0;

  // Quick: count today's messages
  const { count: todayCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lt("created_at", today + "T23:59:59.999");

  const tCount = todayCount ?? 0;

  // FIRST TIME: no streak_broken_on stored → do one-time full scan
  if (!storedBrokenOn && storedStreak === 0) {
    const { brokenOn, streak, longest } = await findStreakBreakDate();
    await supabase
      .from("user_status")
      .update({
        streak_broken_on: brokenOn,
        current_streak: streak,
        longest_streak: longest,
      } as any)
      .eq("user_id", userId);
    return { currentStreak: streak, longestStreak: longest, streakBrokenOn: brokenOn, todayCount: tCount };
  }

  // CASE 1: streak_broken_on is today (no messages yet today when last checked)
  if (storedBrokenOn === today) {
    if (tCount > 0) {
      // Today now has messages! Extend streak
      const newStreak = storedStreak + 1;
      const newLongest = Math.max(storedLongest, newStreak);
      // Find new break: it's the day before the old break chain started
      // Since storedBrokenOn was today and storedStreak was the streak up to yesterday,
      // the real break is now further back. We need to check yesterday-storedStreak-1 day.
      // But simpler: the previous brokenOn was one day before the streak started.
      // streak was X days ending yesterday, break was today. Now streak is X+1 ending today.
      // The break date stays the same as whatever broke before the old streak.
      // We need the date before the streak started = today - newStreak days
      const breakD = new Date();
      breakD.setDate(breakD.getDate() - newStreak);
      const newBrokenOn = breakD.toISOString().slice(0, 10);

      await supabase
        .from("user_status")
        .update({
          current_streak: newStreak,
          longest_streak: newLongest,
          streak_broken_on: newBrokenOn,
        } as any)
        .eq("user_id", userId);
      return { currentStreak: newStreak, longestStreak: newLongest, streakBrokenOn: newBrokenOn, todayCount: tCount };
    }
    // Still no messages today, streak hasn't changed
    return { currentStreak: storedStreak, longestStreak: storedLongest, streakBrokenOn: storedBrokenOn, todayCount: 0 };
  }

  // CASE 2: streak_broken_on is yesterday (yesterday had no messages → streak broke yesterday)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (storedBrokenOn && daysBetween(storedBrokenOn, today) > 1 && storedBrokenOn !== yesterdayStr) {
    // Check if days were missed between stored break and today
    // The break date is old, check if streak continued or broke since
    // Check if yesterday had messages
    const { count: yesterdayCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", yesterdayStr + "T00:00:00")
      .lt("created_at", yesterdayStr + "T23:59:59.999");

    if ((yesterdayCount ?? 0) === 0) {
      // Yesterday had no messages → streak broke yesterday
      const newStreak = tCount > 0 ? 1 : 0;
      const brokenDate = tCount > 0 ? yesterdayStr : today;
      await supabase
        .from("user_status")
        .update({
          current_streak: newStreak,
          streak_broken_on: brokenDate,
          longest_streak: storedLongest,
        } as any)
        .eq("user_id", userId);
      return { currentStreak: newStreak, longestStreak: storedLongest, streakBrokenOn: brokenDate, todayCount: tCount };
    }
  }

  // CASE 3: Normal day, streak is ongoing
  if (tCount > 0) {
    // Today has messages, check if we already counted today
    // If broken_on date + streak days = yesterday, we need to add today
    const streakEndDate = new Date(storedBrokenOn + "T00:00:00");
    streakEndDate.setDate(streakEndDate.getDate() + storedStreak);
    const streakEndStr = streakEndDate.toISOString().slice(0, 10);

    if (streakEndStr !== today) {
      // Haven't counted today yet
      const newStreak = storedStreak + 1;
      const newLongest = Math.max(storedLongest, newStreak);
      await supabase
        .from("user_status")
        .update({
          current_streak: newStreak,
          longest_streak: newLongest,
        } as any)
        .eq("user_id", userId);
      return { currentStreak: newStreak, longestStreak: newLongest, streakBrokenOn: storedBrokenOn, todayCount: tCount };
    }
  } else {
    // No messages today yet - streak_broken_on should be today if not already set
    // But don't update yet, the day isn't over
  }

  return { currentStreak: storedStreak, longestStreak: storedLongest, streakBrokenOn: storedBrokenOn, todayCount: tCount };
}

/**
 * Force full recalculation (e.g. user suspects stale data)
 */
export async function forceRecalculateStreak(userId: string): Promise<StreakData> {
  const { brokenOn, streak, longest } = await findStreakBreakDate();
  await supabase
    .from("user_status")
    .update({
      streak_broken_on: brokenOn,
      current_streak: streak,
      longest_streak: longest,
    } as any)
    .eq("user_id", userId);

  const today = todayStr();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lt("created_at", today + "T23:59:59.999");

  return { currentStreak: streak, longestStreak: longest, streakBrokenOn: brokenOn, todayCount: count ?? 0 };
}
