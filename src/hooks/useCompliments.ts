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

const DAILY_LIMIT = 2;

function getDeliveredTodayCount(): number {
  try {
    const today = new Date().toISOString().split("T")[0];
    const stored = localStorage.getItem("compliments_delivered_date");
    if (stored !== today) {
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
    const current = parseInt(localStorage.getItem("compliments_delivered_count") || "0", 10);
    localStorage.setItem("compliments_delivered_count", String(current + 1));
  } catch {
    // ignore
  }
}

// Module-level singleton to prevent double random fetch across multiple hook instances
let randomFetchDone = false;
let randomFetchResult: Compliment | null = null;
let randomFetchCallbacks: Array<(c: Compliment | null) => void> = [];
let randomFetchInProgress = false;

function resetRandomFetchSingleton() {
  randomFetchDone = false;
  randomFetchResult = null;
  randomFetchCallbacks = [];
  randomFetchInProgress = false;
}

// Reset when session changes (user sign-out etc.)
let lastCheckedUserId: string | null = null;

export function useCompliments() {
  const { user } = useAuth();
  const [compliments, setCompliments] = useState<Compliment[]>([]);
  const [received, setReceived] = useState<Compliment[]>([]);
  const [randomCompliment, setRandomCompliment] = useState<Compliment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset singleton when user changes
  useEffect(() => {
    if (user?.id && user.id !== lastCheckedUserId) {
      lastCheckedUserId = user.id;
      try {
        const shown = sessionStorage.getItem("compliment_checked");
        if (!shown) {
          resetRandomFetchSingleton();
        }
      } catch { /* ignore */ }
    }
  }, [user?.id]);

  const fetchCompliments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("compliments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data && mountedRef.current) setCompliments(data as Compliment[]);
    } catch {
      // silently ignore fetch errors
    }
    if (mountedRef.current) setLoading(false);
  }, [user]);

  const fetchReceived = useCallback(async () => {
    if (!user) return;
    setLoadingReceived(true);
    try {
      const { data } = await (supabase as any)
        .from("compliments")
        .select("*")
        .neq("user_id", user.id)
        .eq("is_delivered", true)
        .order("delivered_at", { ascending: false });

      if (data && mountedRef.current) setReceived(data as Compliment[]);
    } catch {
      // silently ignore
    }
    if (mountedRef.current) setLoadingReceived(false);
  }, [user]);

  const fetchRandomForMe = useCallback(async () => {
    if (!user) return;

    // Already fetched this session — reuse result
    if (randomFetchDone) {
      if (mountedRef.current) setRandomCompliment(randomFetchResult);
      return;
    }

    // Another instance already fetching — subscribe to its result
    if (randomFetchInProgress) {
      randomFetchCallbacks.push((c) => {
        if (mountedRef.current) setRandomCompliment(c);
      });
      return;
    }

    const deliveredToday = getDeliveredTodayCount();
    if (deliveredToday >= DAILY_LIMIT) return;

    randomFetchInProgress = true;

    try {
      const { data } = await (supabase as any)
        .from("compliments")
        .select("*")
        .neq("user_id", user.id)
        .eq("is_delivered", false)
        .order("created_at", { ascending: true })
        .limit(1);

      let result: Compliment | null = null;

      if (data && data.length > 0) {
        const c = data[0] as Compliment;
        result = c;
        // Mark as delivered
        await (supabase as any)
          .from("compliments")
          .update({ is_delivered: true, delivered_at: new Date().toISOString() })
          .eq("id", c.id);
        incrementDeliveredToday();
      }

      randomFetchDone = true;
      randomFetchResult = result;
      randomFetchInProgress = false;

      if (mountedRef.current) setRandomCompliment(result);

      // Notify any waiting instances
      randomFetchCallbacks.forEach((cb) => cb(result));
      randomFetchCallbacks = [];
    } catch {
      randomFetchInProgress = false;
      randomFetchCallbacks.forEach((cb) => cb(null));
      randomFetchCallbacks = [];
    }
  }, [user]);

  useEffect(() => {
    fetchCompliments();
    fetchReceived();
  }, [fetchCompliments, fetchReceived]);

  useEffect(() => {
    if (!user) return;

    // Check session storage to avoid firing on every navigation
    try {
      const shown = sessionStorage.getItem("compliment_checked");
      if (shown) return;
      sessionStorage.setItem("compliment_checked", "true");
    } catch { /* ignore */ }

    // Defer 2.5 seconds so home page renders first without blocking
    const timer = setTimeout(() => {
      fetchRandomForMe();
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, fetchRandomForMe]);

  const addCompliment = useCallback(async (content: string) => {
    if (!user) return;
    try {
      await (supabase as any).from("compliments").insert({
        user_id: user.id,
        content,
      });
      fetchCompliments();
    } catch {
      // ignore
    }
  }, [user, fetchCompliments]);

  const deleteCompliment = useCallback(async (id: string) => {
    try {
      await (supabase as any).from("compliments").delete().eq("id", id);
      setCompliments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  }, []);

  return {
    compliments,
    received,
    randomCompliment,
    loading,
    loadingReceived,
    addCompliment,
    deleteCompliment,
    dismissCompliment: () => {
      randomFetchResult = null;
      setRandomCompliment(null);
    },
  };
}
