import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type UserStatus = Tables<"user_status">;

export function usePartner(currentUserId: string | undefined) {
  const [partner, setPartner] = useState<UserStatus | null>(null);
  const [tick, setTick] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchPartner = async () => {
      const { data } = await supabase
        .from("user_status")
        .select("*")
        .neq("user_id", currentUserId)
        .limit(1)
        .single();
      if (data) setPartner(data);
    };

    fetchPartner();

    // Fallback poll only runs while realtime is NOT connected.
    let fallbackPoll: ReturnType<typeof setInterval> | null = null;
    const startFallback = () => {
      if (fallbackPoll) return;
      fallbackPoll = setInterval(fetchPartner, 10000);
    };
    const stopFallback = () => {
      if (fallbackPoll) {
        clearInterval(fallbackPoll);
        fallbackPoll = null;
      }
    };

    const channelName = `partner-status-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "user_status",
        filter: `user_id=neq.${currentUserId}`,
      }, (payload) => {
        setPartner(payload.new as UserStatus);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallback();
          fetchPartner(); // close any gap opened during (re)connection
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          startFallback();
        }
      });

    channelRef.current = channel;

    return () => {
      stopFallback();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId]);

  const effectivePartner = useMemo(() => {
    if (!partner) return null;
    if (!partner.is_online) return partner;

    const lastPing = partner.updated_at || partner.last_seen;
    if (lastPing) {
      const diff = Date.now() - new Date(lastPing).getTime();
      // If no heartbeat for > 75 seconds, treat as offline
      if (diff > 75000) {
        return {
          ...partner,
          is_online: false,
          activity_state: "offline",
        };
      }
    }
    return partner;
  }, [partner, tick]);

  return effectivePartner;
}
