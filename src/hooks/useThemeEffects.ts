import { useMemo } from "react";

export interface ThemeEffectsConfig {
  themeId: string;
  headerTitle: (partnerName: string) => string;
  headerSubtitle?: string;
  typingText: string;
  inputPlaceholder: string;
  secretPlaceholder: string;
  sendLabel?: string;
  timestampFormat?: "military" | "elapsed" | "elegant" | "retro" | "default";
  ambient: "none" | "petals" | "static" | "scanlines" | "sparkles" | "redlines";
  surprises: "none" | "jumpscare" | "construction" | "transmission" | "petalBurst" | "pixelGlitch";
  surpriseInterval: [number, number]; // min/max seconds
  navStyle?: string;
  headerDecoration?: "marquee" | "classified" | "pixel" | "glitch" | "hearts";
  bubbleExtra?: string;
}

const THEME_EFFECTS: Record<string, ThemeEffectsConfig> = {
  default: {
    themeId: "default",
    headerTitle: (name) => name,
    typingText: "typing...",
    inputPlaceholder: "Type a message...",
    secretPlaceholder: "Write a secret message...",
    ambient: "none",
    surprises: "none",
    surpriseInterval: [0, 0],
  },
  spy: {
    themeId: "spy",
    headerTitle: (name) => `OPERATION: ${name.toUpperCase()}`,
    headerSubtitle: "SECURE CHANNEL • ENCRYPTED",
    typingText: "AGENT IS COMPOSING...",
    inputPlaceholder: "Encode message...",
    secretPlaceholder: "CLASSIFIED INPUT...",
    sendLabel: "TRANSMIT",
    timestampFormat: "military",
    ambient: "redlines",
    surprises: "transmission",
    surpriseInterval: [45, 90],
    headerDecoration: "classified",
    bubbleExtra: "spy-bubble",
  },
  geocities: {
    themeId: "geocities",
    headerTitle: (name) => `~*~ ${name}'s Page ~*~`,
    headerSubtitle: "♦ Best viewed at 800x600 ♦",
    typingText: "Writing in guestbook...",
    inputPlaceholder: "Sign my guestbook...",
    secretPlaceholder: "Secret HTML...",
    sendLabel: "POST IT!",
    timestampFormat: "retro",
    ambient: "sparkles",
    surprises: "construction",
    surpriseInterval: [30, 75],
    headerDecoration: "marquee",
    bubbleExtra: "geocities-bubble",
  },
  gameboy: {
    themeId: "gameboy",
    headerTitle: (name) => name.toUpperCase(),
    headerSubtitle: "▶ SELECT START",
    typingText: "▶ ...",
    inputPlaceholder: "▶ INPUT TEXT_",
    secretPlaceholder: "▶ SECRET CODE_",
    sendLabel: "A",
    timestampFormat: "default",
    ambient: "scanlines",
    surprises: "pixelGlitch",
    surpriseInterval: [60, 120],
    headerDecoration: "pixel",
    bubbleExtra: "gameboy-bubble",
  },
  horror: {
    themeId: "horror",
    headerTitle: (name) => name,
    headerSubtitle: "c̸o̶n̵n̸e̵c̷t̶e̸d̵",
    typingText: "s̷o̶m̵e̸o̷n̵e̸ i̷s̶ t̴y̷p̸i̶n̷g̸...",
    inputPlaceholder: "don't look behind you...",
    secretPlaceholder: "they can hear you...",
    sendLabel: "...",
    timestampFormat: "elapsed",
    ambient: "static",
    surprises: "jumpscare",
    surpriseInterval: [120, 300],
    headerDecoration: "glitch",
    bubbleExtra: "horror-bubble",
  },
  romance: {
    themeId: "romance",
    headerTitle: (name) => `${name} ♥`,
    headerSubtitle: "your beloved",
    typingText: "composing sweet nothings...",
    inputPlaceholder: "Write from the heart...",
    secretPlaceholder: "A secret confession...",
    sendLabel: "♥",
    timestampFormat: "elegant",
    ambient: "petals",
    surprises: "petalBurst",
    surpriseInterval: [40, 80],
    headerDecoration: "hearts",
    bubbleExtra: "romance-bubble",
  },
};

export function useThemeEffects(themeId: string): ThemeEffectsConfig {
  return useMemo(() => THEME_EFFECTS[themeId] ?? THEME_EFFECTS.default, [themeId]);
}
