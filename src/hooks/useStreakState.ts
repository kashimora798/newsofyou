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
 * Full scan: find all unique message days, compute current streak + longest streak.
 * streak_broken_on = the day just before the current streak started (the gap day).
 */
async function fullScan(): Promise<{ brokenOn: string | null; streak: number; longest: number }> {
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

  // brokenOn = the first day going back that had no messages
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
 * Get streak data. Uses stored values in user_status for fast reads.
 * First time: does full scan. After that: incremental check.
 */
export async function getStreakData(userId: string): Promise<StreakData> {
  const today = todayStr();

  const { data: status } = await supabase
    .from("user_status")
    .select("streak_broken_on, current_streak, longest_streak" as any)
    .eq("user_id", userId)
    .single();

  const storedBrokenOn: string | null = (status as any)?.streak_broken_on ?? null;
  const storedStreak: number = (status as any)?.current_streak ?? 0;
  const storedLongest: number = (status as any)?.longest_streak ?? 0;

  // Today's message count
  const { count: todayCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lt("created_at", today + "T23:59:59.999");
  const tCount = todayCount ?? 0;

  // First time: no data stored → full scan
  if (!storedBrokenOn && storedStreak === 0) {
    const { brokenOn, streak, longest } = await fullScan();
    await supabase
      .from("user_status")
      .update({ streak_broken_on: brokenOn, current_streak: streak, longest_streak: longest } as any)
      .eq("user_id", userId);
    return { currentStreak: streak, longestStreak: longest, streakBrokenOn: brokenOn, todayCount: tCount };
  }

  // The stored streak covers days from (brokenOn + 1) to (brokenOn + storedStreak).
  // That "last counted day" tells us if we already counted today.
  const lastCountedDay = addDays(storedBrokenOn!, storedStreak);

  if (lastCountedDay === today) {
    // Already up to date for today
    return { currentStreak: storedStreak, longestStreak: storedLongest, streakBrokenOn: storedBrokenOn, todayCount: tCount };
  }

  // lastCountedDay is before today — need to check if streak continued
  // Check each day between lastCountedDay+1 and today
  const yesterday = addDays(today, -1);

  if (lastCountedDay === yesterday) {
    // Only today is unchecked
    if (tCount > 0) {
      const newStreak = storedStreak + 1;
      const newLongest = Math.max(storedLongest, newStreak);
      await supabase
        .from("user_status")
        .update({ current_streak: newStreak, longest_streak: newLongest } as any)
        .eq("user_id", userId);
      return { currentStreak: newStreak, longestStreak: newLongest, streakBrokenOn: storedBrokenOn, todayCount: tCount };
    }
    // No messages today yet — streak not broken yet (day isn't over)
    return { currentStreak: storedStreak, longestStreak: storedLongest, streakBrokenOn: storedBrokenOn, todayCount: 0 };
  }

  // Multiple days have passed since last check — need to verify no gaps
  // Check if there were messages on every day from lastCountedDay+1 to yesterday
  const dayAfterLast = addDays(lastCountedDay, 1);
  const { data: gapMessages } = await supabase
    .from("messages")
    .select("created_at")
    .gte("created_at", dayAfterLast + "T00:00:00")
    .lt("created_at", today + "T00:00:00");

  const gapDays = new Set<string>();
  if (gapMessages) {
    for (const msg of gapMessages) {
      gapDays.add(msg.created_at.slice(0, 10));
    }
  }

  // Walk from dayAfterLast to yesterday, find first missing day
  let checkDate = dayAfterLast;
  let extraDays = 0;
  let broken = false;
  let newBrokenOn = storedBrokenOn;

  while (checkDate <= yesterday) {
    if (gapDays.has(checkDate)) {
      extraDays++;
    } else {
      // Streak broke on this day
      broken = true;
      newBrokenOn = checkDate;
      extraDays = 0; // reset — count consecutive days after the break
      // Continue to find the latest break
    }
    checkDate = addDays(checkDate, 1);
  }

  if (broken) {
    // Find the new streak: consecutive days from newBrokenOn+1 to yesterday
    let newStreak = 0;
    let d = addDays(newBrokenOn!, 1);
    while (d <= yesterday) {
      if (gapDays.has(d)) {
        newStreak++;
        d = addDays(d, 1);
      } else {
        // Another break
        newBrokenOn = d;
        newStreak = 0;
        d = addDays(d, 1);
      }
    }
    // Check today
    if (tCount > 0) newStreak++;

    const newLongest = Math.max(storedLongest, newStreak);
    await supabase
      .from("user_status")
      .update({ current_streak: newStreak, longest_streak: newLongest, streak_broken_on: newBrokenOn } as any)
      .eq("user_id", userId);
    return { currentStreak: newStreak, longestStreak: newLongest, streakBrokenOn: newBrokenOn, todayCount: tCount };
  }

  // No break found — streak continued through all gap days
  let newStreak = storedStreak + extraDays;
  if (tCount > 0) newStreak++;
  const newLongest = Math.max(storedLongest, newStreak);
  await supabase
    .from("user_status")
    .update({ current_streak: newStreak, longest_streak: newLongest } as any)
    .eq("user_id", userId);
  return { currentStreak: newStreak, longestStreak: newLongest, streakBrokenOn: storedBrokenOn, todayCount: tCount };
}

export async function forceRecalculateStreak(userId: string): Promise<StreakData> {
  const { brokenOn, streak, longest } = await fullScan();
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
