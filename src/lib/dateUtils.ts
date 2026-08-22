import { format, isToday, isYesterday, differenceInMinutes, differenceInHours } from "date-fns";

/**
 * Safely parse any date string/number/Date (including PostgreSQL timestamptz with spaces and microseconds).
 * Returns null if invalid, never throws.
 */
export function parseDateSafely(dateInput: string | number | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === "number") {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateInput === "string") {
    const str = dateInput.trim();
    if (!str) return null;

    // 1. Direct parse attempt
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d;

    // 2. Handle PostgreSQL timestamptz space separator (e.g. "2026-08-12 19:17:43.925592+05:30")
    const withT = str.replace(" ", "T");
    d = new Date(withT);
    if (!isNaN(d.getTime())) return d;

    // 3. Truncate microsecond precision (>3 fraction digits) to milliseconds
    const truncatedFraction = withT.replace(/(\.\d{3})\d+/, "$1");
    d = new Date(truncatedFraction);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function formatMessageTime(dateStr: string | null | undefined): string {
  try {
    const date = parseDateSafely(dateStr);
    if (!date) return "";
    return format(date, "h:mm a");
  } catch {
    return "";
  }
}

export function formatLastSeen(dateStr: string | null | undefined): string {
  try {
    if (!dateStr) return "offline";
    const date = parseDateSafely(dateStr);
    if (!date) return "offline";

    const now = new Date();
    const mins = differenceInMinutes(now, date);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = differenceInHours(now, date);
    if (hrs < 24) return `${hrs}h ago`;
    if (isYesterday(date)) return "yesterday " + format(date, "h:mm a");
    return format(date, "MMM d, h:mm a");
  } catch {
    return "offline";
  }
}

export function formatDateSeparator(dateStr: string | null | undefined): string {
  try {
    const date = parseDateSafely(dateStr);
    if (!date) return "";
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

export function formatFullDate(dateStr: string | null | undefined): string {
  try {
    const date = parseDateSafely(dateStr);
    if (!date) return "";
    return format(date, "MMM d, yyyy 'at' h:mm a");
  } catch {
    return "";
  }
}

export function isSameDay(d1: string | null | undefined, d2: string | null | undefined): boolean {
  try {
    const a = parseDateSafely(d1);
    const b = parseDateSafely(d2);
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  } catch {
    return false;
  }
}
