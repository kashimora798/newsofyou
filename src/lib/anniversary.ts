/**
 * Anniversary configuration for "Our Year" Wrapped.
 *
 * The relationship began on the first chat message: 19 June 2025.
 * Each year on that month/day, the Wrapped experience auto-launches.
 */

// Month is 0-indexed in JS Date (5 = June).
export const ANNIVERSARY_START = new Date(2025, 5, 19);
export const ANNIVERSARY_MONTH = 5; // June
export const ANNIVERSARY_DAY = 19;

/** Window (in days) before the anniversary during which the home banner appears. */
export const BANNER_LEAD_DAYS = 7;
/** Window (in days) after the anniversary during which it still feels "current". */
export const BANNER_TRAIL_DAYS = 7;

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** How many full years since the first message (>= 1 once a year has passed). */
export function yearsTogether(now: Date = new Date()): number {
  let years = now.getFullYear() - ANNIVERSARY_START.getFullYear();
  const hadAnniversaryThisYear =
    now.getMonth() > ANNIVERSARY_MONTH ||
    (now.getMonth() === ANNIVERSARY_MONTH && now.getDate() >= ANNIVERSARY_DAY);
  if (!hadAnniversaryThisYear) years -= 1;
  return Math.max(0, years);
}

/** Total days since the first message. */
export function daysTogether(now: Date = new Date()): number {
  return Math.floor((atMidnight(now).getTime() - atMidnight(ANNIVERSARY_START).getTime()) / 86400000);
}

/** The most recent anniversary date relative to `now` (this year's, or last year's if not reached yet). */
export function lastAnniversaryDate(now: Date = new Date()): Date {
  const thisYears = new Date(now.getFullYear(), ANNIVERSARY_MONTH, ANNIVERSARY_DAY);
  if (now >= thisYears) return thisYears;
  return new Date(now.getFullYear() - 1, ANNIVERSARY_MONTH, ANNIVERSARY_DAY);
}

/** The next upcoming anniversary date. */
export function nextAnniversaryDate(now: Date = new Date()): Date {
  const thisYears = new Date(now.getFullYear(), ANNIVERSARY_MONTH, ANNIVERSARY_DAY);
  if (now <= thisYears) return thisYears;
  return new Date(now.getFullYear() + 1, ANNIVERSARY_MONTH, ANNIVERSARY_DAY);
}

/** Days remaining until the next anniversary (0 = today). */
export function daysUntilAnniversary(now: Date = new Date()): number {
  return Math.ceil((atMidnight(nextAnniversaryDate(now)).getTime() - atMidnight(now).getTime()) / 86400000);
}

/** True exactly on the anniversary day. */
export function isAnniversaryToday(now: Date = new Date()): boolean {
  return now.getMonth() === ANNIVERSARY_MONTH && now.getDate() === ANNIVERSARY_DAY && yearsTogether(now) >= 1;
}

/**
 * True during the banner window: a few days before through a few days after
 * the anniversary. This is when the home banner surfaces.
 */
export function isAnniversaryWindow(now: Date = new Date()): boolean {
  if (yearsTogether(now) < 1 && daysUntilAnniversary(now) > BANNER_LEAD_DAYS) return false;
  const until = daysUntilAnniversary(now);
  const sinceLast = Math.floor((atMidnight(now).getTime() - atMidnight(lastAnniversaryDate(now)).getTime()) / 86400000);
  return until <= BANNER_LEAD_DAYS || sinceLast <= BANNER_TRAIL_DAYS;
}

/** Ordinal label like "1st", "2nd", "3rd", "4th". */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/**
 * sessionStorage guard so the auto-launch only fires once per visit
 * (the user can always replay manually from the banner/menu).
 */
const AUTO_KEY = "wrapped-autolaunched";
export function hasAutoLaunchedThisSession(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === lastAnniversaryDate().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}
export function markAutoLaunched(): void {
  try {
    localStorage.setItem(AUTO_KEY, lastAnniversaryDate().toISOString().slice(0, 10));
  } catch {
    /* ignore */
  }
}
