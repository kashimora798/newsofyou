import { format, isToday, isYesterday, differenceInMinutes, differenceInHours } from "date-fns";

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, "h:mm a");
}

export function formatLastSeen(dateStr: string | null): string {
  if (!dateStr) return "offline";
  const date = new Date(dateStr);
  const now = new Date();
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = differenceInHours(now, date);
  if (hrs < 24) return `${hrs}h ago`;
  if (isYesterday(date)) return "yesterday " + format(date, "h:mm a");
  return format(date, "MMM d, h:mm a");
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}
