// Decoy / panic mode state + the secret unlock code hashing.
//
// Decoy mode disguises the chat as a generic AI app. It is a shoulder-surfing
// defense only — it does NOT encrypt or protect the underlying data.

import { useEffect, useState } from "react";
import type { DecoySkin } from "@/lib/decoySkins";

const DECOY_ACTIVE_KEY = "decoy-active";

export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function matchesCode(input: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false;
  const h = await hashCode(input);
  return h === storedHash;
}

/**
 * Tracks whether decoy mode is currently showing. Persisted in sessionStorage
 * so a page refresh stays disguised until the correct code is entered.
 */
export function useDecoyState() {
  const [active, setActive] = useState(() => sessionStorage.getItem(DECOY_ACTIVE_KEY) === "1");

  useEffect(() => {
    const sync = () => setActive(sessionStorage.getItem(DECOY_ACTIVE_KEY) === "1");
    window.addEventListener("decoy-change", sync);
    return () => window.removeEventListener("decoy-change", sync);
  }, []);

  const activate = () => {
    sessionStorage.setItem(DECOY_ACTIVE_KEY, "1");
    window.dispatchEvent(new Event("decoy-change"));
  };
  const deactivate = () => {
    sessionStorage.removeItem(DECOY_ACTIVE_KEY);
    window.dispatchEvent(new Event("decoy-change"));
  };

  return { active, activate, deactivate };
}

export interface DecoySettings {
  skin: DecoySkin;
  unlockHash: string | null;
  enabled: boolean;
}
