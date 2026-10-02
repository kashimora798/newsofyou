import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useTwinGreeting — fetches the AI greeting for the top of Home.
 *
 * The greeting is fetched once per browser session (sessionStorage guard) so
 * opening Home repeatedly never burns a live AI call, and the returned `text`
 * is written by the greeting bank on the server (free) unless today's single
 * live greeting is due.
 */

export type GreetingSource = "bank" | "live" | "static" | "consent";

export interface TwinGreeting {
  text: string;
  mood: string | null;
  daypart: string | null;
  source: GreetingSource;
  label: string;
  /** Display name of the twin's owner (snake_case matches the edge function). */
  owner_name: string;
  consented: boolean;
  enabled: boolean;
  /** True when the caller is the twin's owner (used for the consent copy). */
  is_owner_caller?: boolean;
}

const SESSION_KEY = "noy_twin_greeting_v1";

export function useTwinGreeting(enabled = true) {
  const [greeting, setGreeting] = useState<TwinGreeting | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [dismissed, setDismissed] = useState(false);
  const fetched = useRef(false);

  const fetchGreeting = useCallback(
    async (force = false) => {
      if (!enabled) return;
      if (!force) {
        try {
          const cached = sessionStorage.getItem(SESSION_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as { at: number; greeting: TwinGreeting };
            if (Date.now() - parsed.at < 6 * 60 * 60 * 1000) {
              setGreeting(parsed.greeting);
              setLoading(false);
              return;
            }
          }
        } catch {
          /* ignore cache errors */
        }
      }

      setLoading(true);
      try {
        // `preview` is only honoured for the twin's owner, and the server decides
        // that: when it applies, the greeting costs nothing (no bank line used,
        // no live call, no log row) so he can look at Home without disturbing her.
        const { data, error } = await supabase.functions.invoke("twin-greet", {
          body: { preview: true },
        });
        if (error) throw error;
        const payload = data as TwinGreeting;
        setGreeting(payload);
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), greeting: payload }));
        } catch {
          /* ignore */
        }
      } catch {
        setGreeting(null);
      } finally {
        setLoading(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled || fetched.current) return;
    fetched.current = true;
    void fetchGreeting();
  }, [enabled, fetchGreeting]);

  const refresh = useCallback(() => fetchGreeting(true), [fetchGreeting]);

  const clearCache = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { greeting, loading, dismissed, dismiss: () => setDismissed(true), refresh, clearCache };
}
