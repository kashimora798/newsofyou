import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks concurrent online time between two partners.
 * Every 30s, if both are online, increments a shared counter.
 * Gracefully handles missing table/RPC.
 */
export function useSoulmateClock(userId: string, partnerOnline: boolean | undefined) {
  const [totalSeconds, setTotalSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial value
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (supabase as any).from("couple_stats")
          .select("concurrent_seconds")
          .limit(1)
          .maybeSingle();
        if (data) setTotalSeconds(data.concurrent_seconds ?? 0);
      } catch {
        // Table may not exist yet
      }
    };
    load();
  }, []);

  // Increment every 30s when both online
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (partnerOnline) {
      intervalRef.current = setInterval(async () => {
        setTotalSeconds((prev) => {
          const next = prev + 30;
          // Async sync to DB (fire-and-forget)
          (supabase as any).rpc("increment_concurrent_seconds", { seconds_to_add: 30 }).then(() => {});
          return next;
        });
      }, 30000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [partnerOnline]);

  return totalSeconds;
}

export function formatSoulmateTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return { days, hours, minutes };
}
