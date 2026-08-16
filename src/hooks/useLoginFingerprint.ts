/**
 * useLoginFingerprint
 *
 * Captures device/browser/location info and saves it to `user_login_sessions`.
 * Called ONLY from AuthContext.signIn() after a successful email+password login.
 *
 * Uses:
 *  - @fingerprintjs/fingerprintjs  (free, client-side, no API key)
 *  - ipapi.co/json                 (free IP geolocation, no API key)
 *  - navigator APIs                (UA, screen, timezone, language)
 */

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { supabase } from "@/integrations/supabase/client";

// ─── Browser / OS parsers ─────────────────────────────────────────────────────

function parseBrowser(ua: string): { browser: string; version: string } {
  const rules: Array<[RegExp, string]> = [
    [/EdgA?\/([\d.]+)/i, "Edge"],
    [/OPR\/([\d.]+)/i, "Opera"],
    [/SamsungBrowser\/([\d.]+)/i, "Samsung Internet"],
    [/UCBrowser\/([\d.]+)/i, "UC Browser"],
    [/CriOS\/([\d.]+)/i, "Chrome (iOS)"],
    [/FxiOS\/([\d.]+)/i, "Firefox (iOS)"],
    [/Firefox\/([\d.]+)/i, "Firefox"],
    [/Chrome\/([\d.]+)/i, "Chrome"],
    [/Version\/([\d.]+).*Safari/i, "Safari"],
    [/MSIE ([\d.]+)/i, "IE"],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return { browser: name, version: m[1].split(".").slice(0, 2).join(".") };
  }
  return { browser: "Unknown", version: "" };
}

function parseOS(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function parseDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

// ─── IP geolocation (ipapi.co — free tier, no API key) ───────────────────────

interface GeoInfo {
  ip?: string;
  city?: string;
  region?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
}

async function fetchGeoInfo(): Promise<GeoInfo> {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return {};
    return (await res.json()) as GeoInfo;
  } catch {
    return {};
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function captureLoginSession(userId: string): Promise<void> {
  try {
    // Run fingerprint + geo in parallel for speed
    const [fpAgent, geo] = await Promise.all([
      FingerprintJS.load(),
      fetchGeoInfo(),
    ]);

    const fpResult = await fpAgent.get();
    const ua = navigator.userAgent;
    const { browser, version } = parseBrowser(ua);

    await (supabase as any).from("user_login_sessions").insert({
      user_id:         userId,
      fingerprint_id:  fpResult.visitorId,
      ip_address:      geo.ip         ?? null,
      country:         geo.country_name ?? null,
      city:            geo.city        ?? null,
      region:          geo.region      ?? null,
      latitude:        geo.latitude    ?? null,
      longitude:       geo.longitude   ?? null,
      browser,
      browser_version: version,
      os:              parseOS(ua),
      device_type:     parseDeviceType(ua),
      screen_width:    window.screen.width,
      screen_height:   window.screen.height,
      timezone:        Intl.DateTimeFormat().resolvedOptions().timeZone,
      language:        navigator.language,
      user_agent:      ua,
      logged_in_at:    new Date().toISOString(),
    });
  } catch {
    // Non-critical — silently fail so login is never blocked by this
  }
}
