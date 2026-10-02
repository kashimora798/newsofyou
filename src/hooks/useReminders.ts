import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
  const alertedIdsRef = useRef<Set<string>>(new Set());

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("reminders")
        .select("*")
        .or(`user_id.eq.${user.id},target_user_id.eq.${user.id}`)
        .order("remind_at", { ascending: true });

      if (!error && data) {
        setReminders(data as Reminder[]);
      }
    } catch (err) {
      console.error("Error fetching reminders:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Realtime subscription: sync and alert on new incoming partner reminders
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`reminders-realtime-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reminders" }, (payload) => {
        const newRem = payload.new as Reminder;
        if (newRem.target_user_id === user.id && newRem.user_id !== user.id) {
          toast({
            title: "🔔 New Reminder from partner!",
            description: newRem.title,
          });
        }
        fetchReminders();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reminders" }, () => fetchReminders())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reminders" }, () => fetchReminders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchReminders]);

  // Due reminders alert check (runs every 15 seconds)
  useEffect(() => {
    if (!reminders || reminders.length === 0) return;

    const checkDueReminders = () => {
      const now = Date.now();
      let alertedSession: string[] = [];
      try {
        alertedSession = JSON.parse(sessionStorage.getItem("alerted_reminder_ids") || "[]");
      } catch {}
      const sessionSet = new Set([...alertedIdsRef.current, ...alertedSession]);

      let hasNewAlert = false;
      for (const r of reminders) {
        if (r.is_completed) continue;
        const dueTime = new Date(r.remind_at).getTime();
        // If due within the last 2 hours (or current) and not yet alerted in this session
        if (dueTime <= now && now - dueTime < 2 * 60 * 60 * 1000 && !sessionSet.has(r.id)) {
          sessionSet.add(r.id);
          alertedIdsRef.current.add(r.id);
          hasNewAlert = true;

          toast({
            title: `🔔 Reminder: ${r.title}`,
            description: r.note || "It's time for your reminder!",
          });

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`🔔 Reminder: ${r.title}`, {
                body: r.note || "It's time for your reminder!",
              });
            } catch {}
          }
        }
      }

      if (hasNewAlert) {
        try {
          sessionStorage.setItem("alerted_reminder_ids", JSON.stringify([...sessionSet]));
        } catch {}
      }
    };

    checkDueReminders();
    const timer = setInterval(checkDueReminders, 15000);
    return () => clearInterval(timer);
  }, [reminders]);

  const addReminder = useCallback(async (title: string, remindAt: string, targetUserId?: string, note?: string) => {
    if (!user) return { error: new Error("Not authenticated") };
    try {
      const { data, error } = await (supabase as any).from("reminders").insert({
        user_id: user.id,
        target_user_id: targetUserId || user.id,
        title,
        note: note || null,
        remind_at: remindAt,
      }).select().single();

      if (error) {
        console.error("Error creating reminder:", error);
        return { error };
      }

      await fetchReminders();
      return { data, error: null };
    } catch (err: any) {
      console.error("Exception adding reminder:", err);
      return { error: err };
    }
  }, [user, fetchReminders]);

  const completeReminder = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).from("reminders").update({ is_completed: true }).eq("id", id);
      if (error) {
        console.error("Error completing reminder:", error);
        return { error };
      }
      await fetchReminders();
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, [fetchReminders]);

  const deleteReminder = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).from("reminders").delete().eq("id", id);
      if (error) {
        console.error("Error deleting reminder:", error);
        return { error };
      }
      await fetchReminders();
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, [fetchReminders]);

  return { reminders, loading, fetchReminders, addReminder, completeReminder, deleteReminder };
}
