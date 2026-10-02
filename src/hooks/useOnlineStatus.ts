import { useEffect, useRef, useCallback } from "react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

// Inactivity threshold: 60 seconds of no interaction switches status to "away"
const IDLE_TIMEOUT_MS = 60000;

export function useOnlineStatus(userId: string | undefined) {
  const lastInteraction = useRef<number>(Date.now());
  const currentState = useRef<"active" | "away" | "offline">("active");
  const lastTransitionTime = useRef<number>(0);

  const syncStatus = useCallback(async (isOnline: boolean, state: "active" | "away" | "offline") => {
    if (!userId) return;
    currentState.current = state;
    try {
      await (supabase.rpc as any)("update_user_status", {
        p_user_id: userId,
        p_is_online: isOnline,
        p_last_seen: new Date().toISOString(),
        p_activity_state: state,
      });
    } catch (err) {
      console.warn("Failed to sync online status:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Reset interaction timestamp and wake up to "active" if currently "away"
    const handleActivity = () => {
      const now = Date.now();
      lastInteraction.current = now;

      // Throttle rapid wake-up calls
      if (currentState.current === "away") {
        if (now - lastTransitionTime.current > 1500) {
          lastTransitionTime.current = now;
          void syncStatus(true, "active");
        }
      }
    };

    // Initial mark online + active
    lastInteraction.current = Date.now();
    lastTransitionTime.current = Date.now();
    void syncStatus(true, "active");

    // Comprehensive user interaction listeners
    // Throttled mouse movement
    let lastMouseMove = 0;
    const onMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMove > 2500) {
        lastMouseMove = now;
        handleActivity();
      }
    };

    // Throttled scroll
    let lastScroll = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - lastScroll > 2500) {
        lastScroll = now;
        handleActivity();
      }
    };

    const onPointerDown = () => handleActivity();
    const onKeyDown = () => handleActivity();
    const onTouchStart = () => handleActivity();
    const onFocus = () => handleActivity();

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("mousedown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("focus", onFocus);

    // Visibility change handler (tab minimized or switched away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void syncStatus(true, "away");
      } else {
        lastInteraction.current = Date.now();
        void syncStatus(true, "active");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Inactivity checker every 10 seconds
    const activityCheckInterval = setInterval(() => {
      const isHidden = document.visibilityState === "hidden";
      const idleTime = Date.now() - lastInteraction.current;

      if (isHidden || idleTime >= IDLE_TIMEOUT_MS) {
        if (currentState.current !== "away") {
          lastTransitionTime.current = Date.now();
          void syncStatus(true, "away");
        }
      } else if (currentState.current !== "active") {
        lastTransitionTime.current = Date.now();
        void syncStatus(true, "active");
      }
    }, 10000);

    // Heartbeat every 25s to keep connection alive and update last_seen
    const heartbeatInterval = setInterval(() => {
      const isHidden = document.visibilityState === "hidden";
      const idleTime = Date.now() - lastInteraction.current;
      const effectiveState = isHidden || idleTime >= IDLE_TIMEOUT_MS ? "away" : "active";
      void syncStatus(true, effectiveState);
    }, 25000);

    // Tab close / page navigation beacon
    const handleBeforeUnload = () => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;
      const url = `${baseUrl}/rest/v1/rpc/update_user_status`;
      const body = JSON.stringify({
        p_user_id: userId,
        p_is_online: false,
        p_last_seen: new Date().toISOString(),
        p_activity_state: "offline",
      });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
      };
      fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      clearInterval(activityCheckInterval);
      clearInterval(heartbeatInterval);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);

      void syncStatus(false, "offline");
    };
  }, [userId, syncStatus]);
}
