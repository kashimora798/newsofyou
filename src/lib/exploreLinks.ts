import {
  BarChart3,
  BookOpen,
  Bell,
  Bookmark,
  CalendarDays,
  CheckSquare,
  Gamepad2,
  Hand,
  Heart,
  Mail,
  Send,
  Sparkles,
  Sticker,
  TreePine,
  Trophy,
} from "lucide-react";

/**
 * The Explore constellations on Home (build-plan Phase 3).
 *
 * Each entry carries a `hue` instead of a Tailwind colour class: the scene
 * paints the orb from its own palette (`hsl(<hue> 80% 72% / …)`), so every
 * feature stays distinguishable without a boxy card around it.
 */
export interface ExploreLink {
  path: string;
  icon: React.ElementType;
  label: string;
  hue: number;
}

export const EXPLORE_LINKS: ExploreLink[] = [
  { path: "/twin", icon: Sparkles, label: "His AI", hue: 342 },
  { path: "/book", icon: BookOpen, label: "Our Book", hue: 344 },
  { path: "/forest", icon: TreePine, label: "Our Tree", hue: 152 },
  { path: "/games", icon: Gamepad2, label: "Games", hue: 26 },
  { path: "/stats", icon: BarChart3, label: "Stats", hue: 205 },
  { path: "/bookmarks", icon: Bookmark, label: "Saved", hue: 45 },
  { path: "/reminders", icon: Bell, label: "Reminders", hue: 222 },
  { path: "/calendar", icon: CalendarDays, label: "Calendar", hue: 162 },
  { path: "/compliments", icon: Heart, label: "Compliments", hue: 340 },
  { path: "/daily-checklist", icon: CheckSquare, label: "Checklist", hue: 266 },
  { path: "/achievements", icon: Trophy, label: "Trophies", hue: 48 },
  { path: "/letter-collection", icon: Mail, label: "Letters", hue: 350 },
  { path: "/scheduled-messages", icon: Send, label: "Scheduled", hue: 192 },
  { path: "/custom-stickers", icon: Sticker, label: "Stickers", hue: 296 },
  { path: "/custom-touch-reactions", icon: Hand, label: "Touch", hue: 176 },
];
