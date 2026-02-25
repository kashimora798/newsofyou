import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Marks incoming partner messages as seen when the chat is open & visible.
 * Uses the update_user_and_message_status RPC to batch-update all unseen messages.
 */
export function useMarkSeen(userId: string | undefined, messages: Tables<"messages">[]) {
  const lastSeenRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    if (document.visibilityState === "hidden") return;

    // Find unseen partner messages
    const unseenPartnerMsgs = messages.filter(
      m => m.user_id !== userId && !m.seen
    );

    if (unseenPartnerMsgs.length === 0) return;

    const latestId = unseenPartnerMsgs[unseenPartnerMsgs.length - 1].id;
    if (latestId === lastSeenRef.current) return;
    lastSeenRef.current = latestId;

    // Debounce to avoid rapid-fire updates
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await supabase.rpc("update_user_and_message_status", {
        p_user_id: userId,
        p_is_online: true,
        p_mark_messages_seen: true,
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, messages]);

  // Also mark seen when tab becomes visible again
  useEffect(() => {
    if (!userId) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        lastSeenRef.current = null; // Reset to force re-check
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [userId]);
}
