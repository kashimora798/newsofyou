/**
 * bookStyle — the paper the Book is printed on.
 *
 * Four covers, each with a matching spread: the cover is the night palette the
 * app already uses, the spread is paper (light or dark) depending on the cover
 * chosen. Kept in one place so the index, the spread and the (future) printed
 * export never disagree.
 */

export type CoverStyle = "midnight" | "parchment" | "rose" | "starlight";

export interface BookStyleConfig {
  id: CoverStyle;
  label: string;
  blurb: string;
  /** cover gradient (CSS) */
  cover: string;
  /** ink colour on the cover */
  coverInk: string;
  /** a soft glow behind the cover */
  coverGlow: string;
  /** the page spread */
  spread: string;
  ink: string;
  inkSoft: string;
  rule: string;
  /** accent for mood tags and the day number */
  accent: string;
  dark: boolean;
}

export const BOOK_STYLES: Record<CoverStyle, BookStyleConfig> = {
  midnight: {
    id: "midnight",
    label: "Midnight",
    blurb: "in our night colours",
    cover: "linear-gradient(150deg, hsl(234 48% 9%) 0%, hsl(242 40% 15%) 55%, hsl(338 40% 20%) 100%)",
    coverInk: "hsl(44 42% 96%)",
    coverGlow: "hsl(342 68% 74% / 0.4)",
    spread: "linear-gradient(180deg, hsl(238 34% 12%) 0%, hsl(236 30% 10%) 100%)",
    ink: "hsl(44 40% 95%)",
    inkSoft: "hsl(232 20% 72%)",
    rule: "hsl(44 42% 96% / 0.14)",
    accent: "hsl(342 68% 78%)",
    dark: true,
  },
  parchment: {
    id: "parchment",
    label: "Parchment",
    blurb: "an old paper letter",
    cover: "linear-gradient(150deg, #efe6d3 0%, #e4d7bd 60%, #d8c9a8 100%)",
    coverInk: "hsl(28 30% 20%)",
    coverGlow: "rgba(180,140,80,0.35)",
    spread: "linear-gradient(180deg, #f7f1e3 0%, #f1e8d5 100%)",
    ink: "hsl(28 22% 18%)",
    inkSoft: "hsl(28 14% 38%)",
    rule: "rgba(90,70,40,0.18)",
    accent: "hsl(16 60% 44%)",
    dark: false,
  },
  rose: {
    id: "rose",
    label: "Rose",
    blurb: "soft, for a gift",
    cover: "linear-gradient(150deg, #fde7ee 0%, #f8cdd9 55%, #f2b6c6 100%)",
    coverInk: "hsl(340 35% 22%)",
    coverGlow: "rgba(236,140,170,0.4)",
    spread: "linear-gradient(180deg, #fff7fa 0%, #fdeef3 100%)",
    ink: "hsl(340 25% 20%)",
    inkSoft: "hsl(340 15% 40%)",
    rule: "rgba(150,80,105,0.16)",
    accent: "hsl(340 65% 48%)",
    dark: false,
  },
  starlight: {
    id: "starlight",
    label: "Starlight",
    blurb: "for long-distance nights",
    cover: "linear-gradient(150deg, #0d1230 0%, #17204d 55%, #2a2f6b 100%)",
    coverInk: "hsl(220 40% 96%)",
    coverGlow: "hsl(206 80% 70% / 0.4)",
    spread: "linear-gradient(180deg, hsl(226 38% 13%) 0%, hsl(228 34% 10%) 100%)",
    ink: "hsl(220 35% 95%)",
    inkSoft: "hsl(220 20% 72%)",
    rule: "hsl(220 40% 96% / 0.14)",
    accent: "hsl(206 80% 72%)",
    dark: true,
  },
};

export const bookStyle = (id?: string | null): BookStyleConfig =>
  BOOK_STYLES[(id as CoverStyle) ?? "midnight"] ?? BOOK_STYLES.midnight;

/** The chip shown on a page for its mood. */
export const MOOD_LABELS: Record<string, string> = {
  sweet: "sweet",
  playful: "playful",
  flirty: "flirty",
  caring: "caring",
  tender: "tender",
  heavy: "a heavy one",
  ordinary: "an ordinary day",
};

export const dayLabel = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export const shortDayLabel = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const monthLabel = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export const weekdayLabel = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });

export const clockOf = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
};
