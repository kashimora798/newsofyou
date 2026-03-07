import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Reminder {
  id: string;
  user_id: string;
  target_user_id: string | null;
  title: string;
  note: string | null;
  remind_at: string;
  is_completed: boolean;
  created_at: string;
}

export function useReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("reminders")
      .select("*")
      .or(`user_id.eq.${user.id},target_user_id.eq.${user.id}`)
      .order("remind_at", { ascending: true });

    if (data) setReminders(data as Reminder[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("reminders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => fetchReminders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchReminders]);

  const addReminder = useCallback(async (title: string, remindAt: string, targetUserId?: string, note?: string) => {
    if (!user) return;
    await (supabase as any).from("reminders").insert({
      user_id: user.id,
      target_user_id: targetUserId || user.id,
      title,
      note: note || null,
      remind_at: remindAt,
    });
  }, [user]);

  const completeReminder = useCallback(async (id: string) => {
    await (supabase as any).from("reminders").update({ is_completed: true }).eq("id", id);
  }, []);

  const deleteReminder = useCallback(async (id: string) => {
    await (supabase as any).from("reminders").delete().eq("id", id);
  }, []);

  return { reminders, loading, addReminder, completeReminder, deleteReminder };
}
