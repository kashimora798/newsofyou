export interface ChatTheme {
  id: string;
  label: string;
  emoji: string;
  description: string;
  cssClass: string;
  /** Hidden until unlocked (e.g. galaxy via the planet sequence). */
  secret?: boolean;
}

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: "default",
    label: "Default",
    emoji: "💬",
    description: "Standard chat look",
    cssClass: "",
  },
  {
    id: "spy",
    label: "Spy Documents",
    emoji: "🕵️",
    description: "Classified intel — redacted, monospace",
    cssClass: "theme-spy",
  },
  {
    id: "geocities",
    label: "GeoCities '98",
    emoji: "🌐",
    description: "Under construction — retro web vibes",
    cssClass: "theme-geocities",
  },
  {
    id: "gameboy",
    label: "GameBoy",
    emoji: "🎮",
    description: "Green monochrome — pixel nostalgia",
    cssClass: "theme-gameboy",
  },
  {
    id: "horror",
    label: "Horror ARG",
    emoji: "👁️",
    description: "Glitch text — static noise — dread",
    cssClass: "theme-horror",
  },
  {
    id: "romance",
    label: "Romance Novel",
    emoji: "📖",
    description: "Script font — parchment — rose petals",
    cssClass: "theme-romance",
  },
  {
    id: "galaxy",
    label: "Galaxy",
    emoji: "🌌",
    description: "Deep space — starfield — cosmic glow",
    cssClass: "theme-galaxy",
    secret: true,
  },
];

export function getThemeById(id: string): ChatTheme {
  return CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0];
}
