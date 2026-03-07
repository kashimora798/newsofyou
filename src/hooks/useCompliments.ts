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
    const { data } = await (supabase as any)
      .from("compliments")
      .select("*")
      .neq("user_id", user.id)
      .eq("is_delivered", false)
      .limit(1);

    if (data && data.length > 0) {
      const c = data[0] as Compliment;
      setRandomCompliment(c);
      await (supabase as any).from("compliments").update({ is_delivered: true, delivered_at: new Date().toISOString() }).eq("id", c.id);
    } else {
      setRandomCompliment(null);
    }
  }, [user]);

  useEffect(() => { fetchCompliments(); }, [fetchCompliments]);

  useEffect(() => {
    if (!user) return;
    if (Math.random() < 0.3) fetchRandomForMe();
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
