/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  API KEYS — single place for every third‑party key the chat uses.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  HOW TO ADD A KEY (pick ONE way):
 *    1. Recommended: put it in `.env` / your host's env settings, e.g.
 *         VITE_GIPHY_API_KEY=xxxxxxxxxxxxxxxx
 *    2. Or paste it into the HARDCODED block below (quick, but it is then
 *       committed to git — fine for a public GIPHY key, NEVER for secrets).
 *    3. Or paste it once inside the app (GIF tab asks for it) — it is kept in
 *       this browser's localStorage.
 *
 *  Anything here ships to the browser, so only put keys that are SAFE to be public
 *  (GIPHY web keys are). Secret keys (OpenAI, Gemini, Supabase service role…)
 *  must stay in Supabase Edge Function secrets, never in this file.
 *
 *  Get a free GIPHY key: https://developers.giphy.com/dashboard/  (create an "API" app)
 */

// ▼▼▼  PASTE KEYS HERE (optional)  ▼▼▼
const HARDCODED = {
  giphy: "",
};
// ▲▲▲  ─────────────────────────  ▲▲▲

const LS_PREFIX = "newsofyou_key_";

type KeyName = keyof typeof HARDCODED;

const ENV: Record<KeyName, string | undefined> = {
  giphy: import.meta.env.VITE_GIPHY_API_KEY as string | undefined,
};

/** Legacy key name used by the previous GifPicker — still honoured. */
const LEGACY_LS: Partial<Record<KeyName, string>> = { giphy: "newsofyou_giphy_key" };

export function getApiKey(name: KeyName): string {
  const fromEnv = ENV[name]?.trim();
  if (fromEnv) return fromEnv;
  if (HARDCODED[name]) return HARDCODED[name];
  try {
    return (
      localStorage.getItem(LS_PREFIX + name) ||
      (LEGACY_LS[name] ? localStorage.getItem(LEGACY_LS[name]!) : "") ||
      ""
    );
  } catch {
    return "";
  }
}

export function saveApiKey(name: KeyName, value: string) {
  try {
    localStorage.setItem(LS_PREFIX + name, value.trim());
  } catch {
    /* ignore */
  }
}

export const hasApiKey = (name: KeyName) => getApiKey(name).length > 0;

/** Endpoints, kept next to the keys so they're easy to swap. */
export const API_ENDPOINTS = {
  giphy: "https://api.giphy.com/v1/gifs",
} as const;
