import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface ChecklistItem {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  checklist_date: string;
  completed_at: string | null;
  created_at: string;
}

interface Progress {
  completed: number;
  total: number;
}

export function useDailyChecklist(date: Date = new Date()) {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const dateStr = format(date, "yyyy-MM-dd");

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("daily_checklists")
      .select("*")
      .eq("checklist_date", dateStr)
      .order("created_at", { ascending: true });
    if (data) setItems(data as ChecklistItem[]);
    setLoading(false);
  }, [user, dateStr]);

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel(`daily-checklists-${dateStr}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "daily_checklists",
      }, () => {
        fetchItems();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchItems, dateStr]);

  const myItems = items.filter(i => i.user_id === user?.id);
  const partnerItems = items.filter(i => i.user_id !== user?.id);

  const myProgress: Progress = {
    completed: myItems.filter(i => i.is_completed).length,
    total: myItems.length,
  };
  const partnerProgress: Progress = {
    completed: partnerItems.filter(i => i.is_completed).length,
    total: partnerItems.length,
  };

  const addItem = async (title: string) => {
    if (!user) return;
    await supabase.from("daily_checklists").insert({
      user_id: user.id,
      title,
      checklist_date: dateStr,
    } as any);
  };

  const toggleItem = async (id: string, currentCompleted: boolean) => {
    await supabase.from("daily_checklists").update({
      is_completed: !currentCompleted,
      completed_at: !currentCompleted ? new Date().toISOString() : null,
    } as any).eq("id", id);
  };

  const deleteItem = async (id: string) => {
    await supabase.from("daily_checklists").delete().eq("id", id);
  };

  return { myItems, partnerItems, loading, addItem, toggleItem, deleteItem, myProgress, partnerProgress };
}

export function useMissedChecklists() {
  const { user } = useAuth();
  const [missed, setMissed] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("daily_checklists")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .lt("checklist_date", today)
        .order("checklist_date", { ascending: false });
      if (data) setMissed(data as ChecklistItem[]);
      setLoading(false);
    };
    fetch();
  }, [user, today]);

  const carryForward = async (item: ChecklistItem) => {
    if (!user) return;
    await supabase.from("daily_checklists").insert({
      user_id: user.id,
      title: item.title,
      checklist_date: today,
    } as any);
  };

  return { missed, loading, carryForward };
}

export function useChecklistDates() {
  const { user } = useAuth();
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("daily_checklists")
        .select("checklist_date");
      if (data) {
        const unique = [...new Set((data as any[]).map(d => d.checklist_date))];
        setDates(unique);
      }
    };
    fetch();
  }, [user]);

  return dates;
}
