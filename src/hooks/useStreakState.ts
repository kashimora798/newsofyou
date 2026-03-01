import { supabase } from "@/integrations/supabase/client";

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  streakBrokenOn: string | null; // YYYY-MM-DD date the streak broke
  lastCheckedDate: string; // YYYY-MM-DD last date we ran the full check
}

const STORAGE_KEY = (uid: string) => `streak_state_${uid}`;

function getStoredState(userId: string): StreakState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeState(userId: string, state: StreakState) {
  localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(state));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Full recalculation from all messages. Only runs once, then results are cached.
 */
async function fullRecalculate(): Promise<{ daySet: Set<string> }> {
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
  return { daySet };
}

function calcStreakFromDaySet(daySet: Set<string>): StreakState {
  const today = todayStr();

  // Current streak: go backwards from today
  let streak = 0;
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  let brokenOn: string | null = null;

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (daySet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      brokenOn = dateStr;
      break;
    }
  }

  // Longest streak
  const sortedDays = Array.from(daySet).sort();
  let longest = 0;
  let tempStreak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      tempStreak++;
    } else {
      longest = Math.max(longest, tempStreak);
      tempStreak = 1;
    }
  }
  longest = Math.max(longest, tempStreak);

  return {
    currentStreak: streak,
    longestStreak: longest,
    streakBrokenOn: brokenOn,
    lastCheckedDate: today,
  };
}

/**
 * Smart streak calculator:
 * - On first run: full recalculation, stores result
 * - On subsequent runs: only checks if today has messages (quick query)
 * - Only recalculates fully if the stored state is stale (> 1 day old)
 */
export async function getStreakData(userId: string): Promise<StreakState & { todayCount: number }> {
  const today = todayStr();
  const stored = getStoredState(userId);

  // Quick check: how many messages today?
  const { count: todayCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lt("created_at", addDays(today, 1) + "T00:00:00");

  const tCount = todayCount ?? 0;

  // If we have stored state from today, just use it (update todayCount)
  if (stored && stored.lastCheckedDate === today) {
    // But update current streak if today now has messages and it didn't before
    if (tCount > 0 && stored.streakBrokenOn === today) {
      // Today now has messages! Streak extends by 1
      const updated: StreakState = {
        ...stored,
        currentStreak: stored.currentStreak + 1,
        longestStreak: Math.max(stored.longestStreak, stored.currentStreak + 1),
        streakBrokenOn: null, // No break visible (streak is active through today)
        lastCheckedDate: today,
      };
      // Find the actual break: check day before the old streak start
      // The old streakBrokenOn was today, meaning streak was 0 or didn't include today
      // Now we need to find the real break date by going back from yesterday
      const { daySet } = await fullRecalculate();
      const fresh = calcStreakFromDaySet(daySet);
      storeState(userId, fresh);
      return { ...fresh, todayCount: tCount };
    }
    return { ...stored, todayCount: tCount };
  }

  // If stored state is from yesterday and today has messages, we can do a quick update
  if (stored && stored.lastCheckedDate === yesterdayStr() && tCount > 0) {
    // Yesterday's state + today has messages = streak continues
    if (stored.currentStreak > 0) {
      const updated: StreakState = {
        currentStreak: stored.currentStreak + 1,
        longestStreak: Math.max(stored.longestStreak, stored.currentStreak + 1),
        streakBrokenOn: stored.streakBrokenOn,
        lastCheckedDate: today,
      };
      storeState(userId, updated);
      return { ...updated, todayCount: tCount };
    }
  }

  // Full recalculation needed
  const { daySet } = await fullRecalculate();
  const state = calcStreakFromDaySet(daySet);
  storeState(userId, state);
  return { ...state, todayCount: tCount };
}

/**
 * Force a full recalculation (e.g., when user suspects data is stale)
 */
export async function forceRecalculateStreak(userId: string): Promise<StreakState & { todayCount: number }> {
  const today = todayStr();
  const { daySet } = await fullRecalculate();
  const state = calcStreakFromDaySet(daySet);
  storeState(userId, state);

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lt("created_at", addDays(today, 1) + "T00:00:00");

  return { ...state, todayCount: count ?? 0 };
}
