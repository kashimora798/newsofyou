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

const DAILY_LIMIT = 2; // max compliments shown in a calendar day

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function getDailyCount(userId: string): number {
  try {
    const today = getTodayString();
    const storedDate = localStorage.getItem(`compliment_date_${userId}`);
    if (storedDate !== today) {
      localStorage.setItem(`compliment_date_${userId}`, today);
      localStorage.setItem(`compliment_count_${userId}`, "0");
      return 0;
    }
    return parseInt(localStorage.getItem(`compliment_count_${userId}`) || "0", 10);
  } catch {
    return 0;
  }
}

function incrementDailyCount(userId: string) {
  try {
    const today = getTodayString();
    localStorage.setItem(`compliment_date_${userId}`, today);
    const c = getDailyCount(userId);
    localStorage.setItem(`compliment_count_${userId}`, String(c + 1));
  } catch { /* ignore */ }
}

function hasCheckedThisSession(userId: string): boolean {
  try {
    return sessionStorage.getItem(`compliment_session_delivered_${userId}`) === "true";
  } catch {
    return false;
  }
}

function markCheckedThisSession(userId: string) {
  try {
    sessionStorage.setItem(`compliment_session_delivered_${userId}`, "true");
  } catch { /* ignore */ }
}

export function useCompliments() {
  const { user } = useAuth();
  const [compliments, setCompliments] = useState<Compliment[]>([]);
  const [received, setReceived] = useState<Compliment[]>([]);
  const [surpriseCompliment, setSurpriseCompliment] = useState<Compliment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch compliments written by current user
  const fetchCompliments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("compliments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data && mountedRef.current) {
        setCompliments(data as Compliment[]);
      }
    } catch {
      /* silently ignore */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  // Fetch delivered compliments received by current user from partner
  const fetchReceived = useCallback(async () => {
    if (!user) return;
    setLoadingReceived(true);
    try {
      const { data, error } = await supabase
        .from("compliments")
        .select("*")
        .neq("user_id", user.id)
        .eq("is_delivered", true)
        .order("delivered_at", { ascending: false });

      if (!error && data && mountedRef.current) {
        setReceived(data as Compliment[]);
      }
    } catch {
      /* silently ignore */
    } finally {
      if (mountedRef.current) setLoadingReceived(false);
    }
  }, [user]);

  // Check and deliver an undelivered compliment from the partner
  const checkSurprise = useCallback(async () => {
    if (!user) return;

    // Check session and daily limits
    if (hasCheckedThisSession(user.id)) return;
    if (getDailyCount(user.id) >= DAILY_LIMIT) return;

    try {
      // Find oldest undelivered compliment written by partner
      const { data, error } = await supabase
        .from("compliments")
        .select("*")
        .neq("user_id", user.id)
        .eq("is_delivered", false)
        .order("created_at", { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        markCheckedThisSession(user.id);
        return;
      }

      const item = data[0] as Compliment;
      const now = new Date().toISOString();

      // Mark delivered in database immediately
      await supabase
        .from("compliments")
        .update({ is_delivered: true, delivered_at: now } as any)
        .eq("id", item.id);

      markCheckedThisSession(user.id);
      incrementDailyCount(user.id);

      if (mountedRef.current) {
        setSurpriseCompliment({ ...item, is_delivered: true, delivered_at: now });
      }
    } catch {
      markCheckedThisSession(user.id);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    fetchCompliments();
    fetchReceived();
  }, [fetchCompliments, fetchReceived]);

  // Add a new compliment
  const addCompliment = useCallback(async (content: string) => {
    if (!user || !content.trim()) return;
    try {
      const { data, error } = await supabase
        .from("compliments")
        .insert({
          user_id: user.id,
          content: content.trim(),
          is_delivered: false,
        } as any)
        .select()
        .single();

      if (!error && data && mountedRef.current) {
        setCompliments((prev) => [data as Compliment, ...prev]);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  // Delete a compliment
  const deleteCompliment = useCallback(async (id: string) => {
    try {
      await supabase.from("compliments").delete().eq("id", id);
      if (mountedRef.current) {
        setCompliments((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Dismiss surprise popup
  const dismissSurprise = useCallback(() => {
    setSurpriseCompliment(null);
  }, []);

  return {
    compliments,
    received,
    surpriseCompliment,
    randomCompliment: surpriseCompliment, // backwards-compatible alias
    loading,
    loadingReceived,
    checkSurprise,
    addCompliment,
    deleteCompliment,
    dismissSurprise,
    dismissCompliment: dismissSurprise, // backwards-compatible alias
  };
}
