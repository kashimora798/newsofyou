import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  emoji: string | null;
  created_at: string;
}

export function useSharedCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("shared_events")
      .select("*")
      .order("event_date", { ascending: true });

    if (data) setEvents(data as CalendarEvent[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("shared-events-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_events" }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchEvents]);

  const addEvent = useCallback(async (title: string, eventDate: string, emoji?: string, description?: string) => {
    if (!user) return;
    await (supabase as any).from("shared_events").insert({
      user_id: user.id,
      title,
      event_date: eventDate,
      emoji: emoji || "📅",
      description: description || null,
    });
  }, [user]);

  const deleteEvent = useCallback(async (id: string) => {
    await (supabase as any).from("shared_events").delete().eq("id", id);
  }, []);

  return { events, loading, addEvent, deleteEvent };
}
