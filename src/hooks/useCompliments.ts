import { useState, useEffect, useCallback } from "react";
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
  const today = new Date().toISOString().split("T")[0];
  const stored = localStorage.getItem("compliments_delivered_date");
  if (stored !== today) {
    localStorage.setItem("compliments_delivered_date", today);
    localStorage.setItem("compliments_delivered_count", "0");
    return 0;
  }
  return parseInt(localStorage.getItem("compliments_delivered_count") || "0", 10);
}

function incrementDeliveredToday() {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem("compliments_delivered_date", today);
  const current = parseInt(localStorage.getItem("compliments_delivered_count") || "0", 10);
  localStorage.setItem("compliments_delivered_count", String(current + 1));
}

export function useCompliments() {
  const { user } = useAuth();
  const [compliments, setCompliments] = useState<Compliment[]>([]);
  const [randomCompliment, setRandomCompliment] = useState<Compliment | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompliments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("compliments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setCompliments(data as Compliment[]);
    setLoading(false);
  }, [user]);

  const fetchRandomForMe = useCallback(async () => {
    if (!user) return;

    // Check daily limit
    const deliveredToday = getDeliveredTodayCount();
    if (deliveredToday >= DAILY_LIMIT) return;

    // Fetch undelivered compliments from partner
    const { data } = await (supabase as any)
      .from("compliments")
      .select("*")
      .neq("user_id", user.id)
      .eq("is_delivered", false)
      .order("created_at", { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      const c = data[0] as Compliment;
      setRandomCompliment(c);
      // Mark as delivered permanently
      await (supabase as any)
        .from("compliments")
        .update({ is_delivered: true, delivered_at: new Date().toISOString() })
        .eq("id", c.id);
      incrementDeliveredToday();
    } else {
      setRandomCompliment(null);
    }
  }, [user]);

  useEffect(() => { fetchCompliments(); }, [fetchCompliments]);

  useEffect(() => {
    if (!user) return;
    // Only attempt delivery once per session
    const shown = sessionStorage.getItem("compliment_checked");
    if (shown) return;
    sessionStorage.setItem("compliment_checked", "true");
    fetchRandomForMe();
  }, [user, fetchRandomForMe]);

  const addCompliment = useCallback(async (content: string) => {
    if (!user) return;
    await (supabase as any).from("compliments").insert({
      user_id: user.id,
      content,
    });
    fetchCompliments();
  }, [user, fetchCompliments]);

  const deleteCompliment = useCallback(async (id: string) => {
    await (supabase as any).from("compliments").delete().eq("id", id);
    setCompliments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { compliments, randomCompliment, loading, addCompliment, deleteCompliment, dismissCompliment: () => setRandomCompliment(null) };
}
