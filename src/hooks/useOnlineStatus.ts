import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOnlineStatus(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastInteraction = useRef(Date.now());
  const currentState = useRef<string>("active");

  const setOnline = useCallback(async (online: boolean) => {
    if (!userId) return;
    await supabase.rpc("update_user_status", {
      p_user_id: userId,
      p_is_online: online,
      p_last_seen: new Date().toISOString(),
    });
  }, [userId]);

  const updateActivityState = useCallback(async (state: string) => {
    if (!userId || currentState.current === state) return;
    currentState.current = state;
    await supabase.from("user_status").update({
      activity_state: state,
      updated_at: new Date().toISOString(),
      is_online: state !== "offline",
    } as any).eq("user_id", userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Set online immediately
    setOnline(true);
    updateActivityState("active");

    // Track user interactions for idle detection
    const resetInteraction = () => {
      lastInteraction.current = Date.now();
      if (currentState.current !== "active") {
        updateActivityState("active");
      }
    };

    // Use passive listeners for performance
    window.addEventListener("click", resetInteraction, { passive: true });
    window.addEventListener("keypress", resetInteraction, { passive: true });
    window.addEventListener("touchstart", resetInteraction, { passive: true });
    // Skip scroll listener — too noisy, click/touch/key covers interaction detection

    // Heartbeat every 30s — also checks idle
    intervalRef.current = setInterval(() => {
      const idleTime = Date.now() - lastInteraction.current;
      if (document.visibilityState === "hidden") {
        updateActivityState("away");
      } else if (idleTime > 120000) {
        updateActivityState("idle");
      } else {
        updateActivityState("active");
      }

      supabase
        .from("user_status")
        .update({ updated_at: new Date().toISOString(), is_online: true } as any)
        .eq("user_id", userId)
        .then();
    }, 30000);

    // Tab close / navigate away
    const handleBeforeUnload = () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/update_user_status`;
      const body = JSON.stringify({
        p_user_id: userId,
        p_is_online: false,
        p_last_seen: new Date().toISOString(),
      });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };
      fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        updateActivityState("away");
      } else {
        lastInteraction.current = Date.now();
        updateActivityState("active");
        setOnline(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("click", resetInteraction);
      window.removeEventListener("keypress", resetInteraction);
      window.removeEventListener("touchstart", resetInteraction);
      setOnline(false);
      updateActivityState("offline");
    };
  }, [userId, setOnline, updateActivityState]);
}
