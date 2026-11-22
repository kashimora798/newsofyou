import { supabase } from "@/integrations/supabase/client";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streakBrokenOn: string | null;
  todayCount: number;
}

/* ───────────────────────── Date helpers (LOCAL time) ─────────────────────────
 * The old code mixed UTC (`toISOString`) with local parsing, so around midnight
 * the "today" it looked at was often the wrong calendar day. Everything here
 * works on the user's local calendar day.
 */
const pad = (n: number) => String(n).padStart(2, "0");

export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseLocal(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(day: string, delta: number): string {
  const d = parseLocal(day);
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}

const userTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/* ───────────────────────── Loading the set of active days ───────────────────── */

const PAGE = 1000; // PostgREST's hard per-request cap
const MAX_PAGES = 200; // 200k messages — safety valve, never loops forever

/** Preferred: one tiny SQL call returning a row per active day. */
async function daysFromRpc(): Promise<Set<string> | null> {
  const { data, error } = await (supabase as any).rpc("get_message_days", { tz: userTz() });
  if (error || !Array.isArray(data)) return null;
  return new Set<string>(data.map((r: { day: string }) => r.day));
}

/**
 * Fallback when the SQL function hasn't been deployed yet: page through message
 * timestamps (1000 per request — this is what the old code forgot to do) and
 * bucket them by local day.
 */
async function daysFromPagination(): Promise<Set<string>> {
  const days = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("messages")
      .select("created_at")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      if (row.created_at) days.add(localDateStr(new Date(row.created_at)));
    }
    if (data.length < PAGE) break;
  }
  return days;
}

const CACHE_KEY = "newsofyou_msg_days_v2";

interface DayCache {
  /** local date the set was fetched on */
  fetchedOn: string;
  days: string[];
}

function readCache(): DayCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DayCache) : null;
  } catch {
    return null;
  }
}

/**
 * Active days = everything up to yesterday (immutable, cached once per day)
 * + today (a cheap head-count query). Keeps the Home screen instant.
 */
async function loadActiveDaysThroughYesterday(force: boolean): Promise<Set<string>> {
  const today = localDateStr();
  const cached = readCache();
  if (!force && cached && cached.fetchedOn === today) return new Set(cached.days);

  const days = (await daysFromRpc()) ?? (await daysFromPagination());
  days.delete(today); // today is always counted live
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedOn: today, days: [...days] } satisfies DayCache));
  } catch {
    /* storage full / private mode — just skip the cache */
  }
  return days;
}

async function countToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  return count ?? 0;
}

/* ───────────────────────── Pure streak maths ───────────────────────────────── */

export function computeStreak(activeDays: Set<string>, today: string, todayActive: boolean) {
  const has = (d: string) => activeDays.has(d) || (d === today && todayActive);

  // Current streak: today counts if there's a message; otherwise the streak is
  // still "alive" until midnight, so we count back from yesterday.
  let cursor = todayActive ? today : addDays(today, -1);
  let current = 0;
  while (has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const brokenOn = current > 0 || activeDays.size > 0 ? cursor : null;

  // Longest streak: scan sorted days once.
  const all = new Set(activeDays);
  if (todayActive) all.add(today);
  const sorted = [...all].sort();
  let longest = sorted.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }
  return { current, longest: Math.max(longest, current), brokenOn };
}

async function compute(userId: string, force: boolean): Promise<StreakData> {
  const today = localDateStr();
  const [days, todayCount] = await Promise.all([loadActiveDaysThroughYesterday(force), countToday()]);
  const { current, longest, brokenOn } = computeStreak(days, today, todayCount > 0);

  // Keep the stored copy in sync (other screens / the partner can read it), but we
  // never TRUST it for display any more — that stale cache is what froze at 56.
  void supabase
    .from("user_status")
    .update({ streak_broken_on: brokenOn, current_streak: current, longest_streak: longest } as any)
    .eq("user_id", userId)
    .then(() => undefined);

  return { currentStreak: current, longestStreak: longest, streakBrokenOn: brokenOn, todayCount };
}

export async function getStreakData(userId: string): Promise<StreakData> {
  return compute(userId, false);
}

export async function forceRecalculateStreak(userId: string): Promise<StreakData> {
  return compute(userId, true);
}
