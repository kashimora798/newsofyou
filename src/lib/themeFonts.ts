import { CHAT_THEMES } from "@/lib/chatThemes";

/**
 * themeFonts.ts — the theme faces, fetched only when a theme is worn.
 *
 * The chat has six themed looks, each with its own typeface (typewriter for the
 * spy theme, pixel for the gameboy one, and so on). All seven of those families
 * used to load on every visit, whether or not a theme was ever opened — so the
 * decoy landing page paid for a horror font it could never show.
 *
 * Now the base UI keeps Nunito + Quicksand + Caveat (see `index.css`), and a
 * theme's family is requested the moment that theme is put on. Each family is
 * asked for once, ever, and the request is `display=swap`, so text is never
 * invisible while a font is on its way.
 */

/** Theme css class → the families it needs and the single URL that carries them. */
const THEME_FONTS: Record<string, { families: string; url: string }> = {
  "theme-spy": {
    families: "Special Elite",
    url: "https://fonts.googleapis.com/css2?family=Special+Elite&display=swap",
  },
  "theme-geocities": {
    families: "Comic Neue",
    url: "https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap",
  },
  "theme-gameboy": {
    families: "Silkscreen",
    url: "https://fonts.googleapis.com/css2?family=Silkscreen&display=swap",
  },
  "theme-horror": {
    families: "Creepster, Share Tech Mono",
    url: "https://fonts.googleapis.com/css2?family=Creepster&family=Share+Tech+Mono&display=swap",
  },
  "theme-romance": {
    families: "Lora, Playfair Display",
    url: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lora:ital@0;1&display=swap",
  },
};

const requested = new Set<string>();

/** Fetch the families this theme needs. Safe to call repeatedly; no-op offline. */
export function ensureThemeFontsFor(cssClass?: string | null): void {
  if (!cssClass || requested.has(cssClass)) return;
  const entry = THEME_FONTS[cssClass];
  if (!entry) return;

  requested.add(cssClass);
  try {
    if (document.querySelector(`link[data-theme-font="${cssClass}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = entry.url;
    link.dataset.themeFont = cssClass;
    document.head.appendChild(link);
  } catch {
    /* no document (tests, SSR) — the system fallback in the CSS still reads fine */
  }
}

/** Convenience: the theme id from `chatThemes.ts` rather than its class. */
export function ensureThemeFontsForId(themeId?: string | null): void {
  const theme = CHAT_THEMES.find((t) => t.id === themeId);
  ensureThemeFontsFor(theme?.cssClass);
}

/** What a theme's families are, for the settings preview label. */
export function themeFamilies(cssClass: string): string | null {
  return THEME_FONTS[cssClass]?.families ?? null;
}
