import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Compliment {
  id: string;
  user_id: string;
  content: string;
  is_delivered: boolean;
  delivered_at: string | null;
  created_at: string;
}

const DAILY_LIMIT = 2; // max compliments shown across all sessions in a calendar day
const SESSION_LIMIT = 1; // exactly 1 compliment per login session

// ─── Daily delivery counter (localStorage) ───────────────────────────────────

function getDeliveredTodayCount(): number {
  try {
    const today = new Date().toISOString().split("T")[0];
    const storedDate = localStorage.getItem("compliments_delivered_date");
    if (storedDate !== today) {
      localStorage.setItem("compliments_delivered_date", today);
      localStorage.setItem("compliments_delivered_count", "0");
      return 0;
    }
    return parseInt(localStorage.getItem("compliments_delivered_count") || "0", 10);
  } catch {
    return 0;
  }
}

function incrementDeliveredToday() {
  try {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("compliments_delivered_date", today);
    const c = parseInt(localStorage.getItem("compliments_delivered_count") || "0", 10);
    localStorage.setItem("compliments_delivered_count", String(c + 1));
  } catch { /* ignore */ }
}

// ─── Module-level session singleton ──────────────────────────────────────────
// Prevents double-fetching across multiple hook instances (e.g. Home + ComplimentBox).
// Cleared only when a different user logs in.

let sessionDone = false;          // true once fetch completed this browser session
let sessionInProgress = false;    // true while fetch is in-flight
let sessionQueue: Compliment[] = [];  // queue of compliments to show (max 2)
let sessionCallbacks: Array<(q: Compliment[]) => void> = [];
let sessionUserId: string | null = null;

function resetSingleton() {
  sessionDone = false;
  sessionInProgress = false;
  sessionQueue = [];
  sessionCallbacks = [];
}

// ── Per-session delivery tracking (sessionStorage) ────────────────────────────
// Each browser session (tab open) can deliver at most SESSION_LIMIT compliments.
// Uses sessionStorage so it resets on fresh login/tab, but survives within-session navigation.

function getSessionDeliveredCount(): number {
  try {
    return parseInt(sessionStorage.getItem("session_compliment_count") || "0", 10);
  } catch { return 0; }
}

function incrementSessionDelivered() {
  try {
    const c = getSessionDeliveredCount();
    sessionStorage.setItem("session_compliment_count", String(c + 1));
  } catch { /* ignore */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCompliments() {
  const { user } = useAuth();
  const [compliments, setCompliments] = useState<Compliment[]>([]);
  const [received, setReceived]       = useState<Compliment[]>([]);
  // The single compliment currently shown in the popup; null = popup closed
  const [activeCompliment, setActiveCompliment] = useState<Compliment | null>(null);
  const [loading, setLoading]               = useState(true);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset singleton on user switch (sign-out / sign-in as different person)
  useEffect(() => {
    if (user?.id && user.id !== sessionUserId) {
      sessionUserId = user.id;
      resetSingleton();
    }
  }, [user?.id]);

  // ── Fetch my sent compliments ────────────────────────────────────────────────
  const fetchCompliments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("compliments").select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data && mountedRef.current) setCompliments(data as Compliment[]);
    } catch { /* silently ignore */ }
    if (mountedRef.current) setLoading(false);
  }, [user]);

  // ── Fetch already-delivered received compliments ─────────────────────────────
  const fetchReceived = useCallback(async () => {
    if (!user) return;
    setLoadingReceived(true);
    try {
      const { data } = await (supabase as any)
        .from("compliments").select("*")
        .neq("user_id", user.id)
        .eq("is_delivered", true)
        .order("delivered_at", { ascending: false });
      if (data && mountedRef.current) setReceived(data as Compliment[]);
    } catch { /* silently ignore */ }
    if (mountedRef.current) setLoadingReceived(false);
  }, [user]);

  // ── Fetch & queue undelivered compliments from partner ───────────────────────
  // - Runs once per browser session (guarded by sessionDone + sessionStorage)
  // - Fetches up to (DAILY_LIMIT - deliveredToday) oldest undelivered items
  // - Marks all of them is_delivered=true in DB immediately
  // - Shows them one at a time via activeCompliment; dismiss shows next
  const fetchQueueForMe = useCallback(async () => {
    if (!user) return;

    // Reuse the session result on re-navigation
    if (sessionDone) {
      if (sessionQueue.length > 0 && mountedRef.current) {
        setActiveCompliment(sessionQueue[0]);
      }
      return;
    }

    // Another component instance is already fetching — subscribe to its result
    if (sessionInProgress) {
      sessionCallbacks.push((q) => {
        if (mountedRef.current && q.length > 0) setActiveCompliment(q[0]);
      });
      return;
    }

    const alreadyDelivered = getDeliveredTodayCount();
    const canDeliver = DAILY_LIMIT - alreadyDelivered;
    if (canDeliver <= 0) {
      sessionDone = true;
      return;
    }

    sessionInProgress = true;

    try {
      // Fetch exactly 1 oldest undelivered compliment written by partner
      const { data } = await (supabase as any)
        .from("compliments").select("*")
        .neq("user_id", user.id)
        .eq("is_delivered", false)
        .order("created_at", { ascending: true })
        .limit(1); // 1 per login session

      const toDeliver: Compliment[] = data ?? [];

      if (toDeliver.length > 0) {
        const now = new Date().toISOString();
        // Mark delivered in DB
        await (supabase as any)
          .from("compliments")
          .update({ is_delivered: true, delivered_at: now })
          .eq("id", toDeliver[0].id);
        // Increment both daily (localStorage) and session (sessionStorage) counters
        incrementDeliveredToday();
        incrementSessionDelivered();
        // Store in singleton queue
        sessionQueue = [{ ...toDeliver[0], is_delivered: true, delivered_at: now }];
      }

      sessionDone = true;
      sessionInProgress = false;

      if (mountedRef.current && sessionQueue.length > 0) {
        setActiveCompliment(sessionQueue[0]);
      }

      sessionCallbacks.forEach((cb) => cb(sessionQueue));
      sessionCallbacks = [];
    } catch {
      sessionInProgress = false;
      sessionDone = true;
      sessionCallbacks.forEach((cb) => cb([]));
      sessionCallbacks = [];
    }
  }, [user]);

  useEffect(() => {
    fetchCompliments();
    fetchReceived();
  }, [fetchCompliments, fetchReceived]);

  useEffect(() => {
    if (!user) return;

    // Guard: only deliver 1 compliment per session (sessionStorage resets on new tab/login).
    // Also gate by daily limit (localStorage resets at midnight).
    const alreadyDelivered = getDeliveredTodayCount();
    const sessionDelivered = getSessionDeliveredCount();

    if (alreadyDelivered >= DAILY_LIMIT || sessionDelivered >= SESSION_LIMIT) {
      // Limit reached — but still re-surface if one is queued from earlier this session
      if (sessionDone && sessionQueue.length > 0 && mountedRef.current) {
        setActiveCompliment(sessionQueue[0]);
      }
      return;
    }

    // Defer 2.5s so home page renders before the popup appears
    const timer = setTimeout(() => { fetchQueueForMe(); }, 2500);
    return () => clearTimeout(timer);
  }, [user, fetchQueueForMe]);

  // ── Sent compliments management ──────────────────────────────────────────────
  const addCompliment = useCallback(async (content: string) => {
    if (!user) return;
    try {
      await (supabase as any)
        .from("compliments")
        .insert({ user_id: user.id, content });
      fetchCompliments();
    } catch { /* ignore */ }
  }, [user, fetchCompliments]);

  const deleteCompliment = useCallback(async (id: string) => {
    try {
      await (supabase as any).from("compliments").delete().eq("id", id);
      setCompliments((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  }, []);

  // ── Dismiss current popup → show next queued compliment after brief gap ──────
  const dismissCompliment = useCallback(() => {
    setActiveCompliment((prev) => {
      if (!prev) return null;
      // Defensively ensure marked delivered in DB
      void (supabase as any)
        .from("compliments")
        .update({ is_delivered: true, delivered_at: new Date().toISOString() })
        .eq("id", prev.id);

      // Remove dismissed item from queue
      const idx = sessionQueue.findIndex((c) => c.id === prev.id);
      if (idx !== -1) sessionQueue.splice(idx, 1);
      // Show next after 350ms gap for smooth UX
      if (sessionQueue.length > 0) {
        const next = sessionQueue[0];
        setTimeout(() => {
          if (mountedRef.current) setActiveCompliment(next);
        }, 350);
      }
      return null; // close current popup immediately
    });
  }, []);

  return {
    compliments,
    received,
    /** Compliment currently displayed in the popup. null = no popup. */
    randomCompliment: activeCompliment,
    loading,
    loadingReceived,
    addCompliment,
    deleteCompliment,
    dismissCompliment,
  };
}
