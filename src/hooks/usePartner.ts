import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type UserStatus = Tables<"user_status">;

export function usePartner(currentUserId: string | undefined) {
  const [partner, setPartner] = useState<UserStatus | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  return partner;
}
