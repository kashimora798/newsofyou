import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Uses Supabase Broadcast for instant typing indicators (no DB latency).
 * Falls back to polling typing_status table for reliability.
 */
export function useTyping(userId: string | undefined, username: string | undefined) {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const partnerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Send typing status via Broadcast (instant, no DB write)
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!userId) return;
    supabase.channel("typing-broadcast").send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId, username, is_typing: isTyping },
    });
  }, [userId, username]);

  // Also persist to DB for fallback
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!userId || !username) return;
    broadcastTyping(isTyping);
    await supabase.from("typing_status").upsert({
      user_id: userId,
      username,
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }, [userId, username, broadcastTyping]);

  const handleTyping = useCallback(() => {
    broadcastTyping(true);
    // Also write to DB (fire and forget)
    if (userId && username) {
      supabase.from("typing_status").upsert({
        user_id: userId,
        username,
        is_typing: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
      if (userId && username) {
        supabase.from("typing_status").upsert({
          user_id: userId,
          username,
          is_typing: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    }, 3000);
  }, [broadcastTyping, userId, username]);

  useEffect(() => {
    if (!userId) return;

    // Listen for broadcast typing events (instant)
    const channel = supabase
      .channel("typing-broadcast")
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload;
        if (data.user_id !== userId) {
          setPartnerTyping(data.is_typing ?? false);
          // Auto-clear after 4s if no update
          if (partnerTimeoutRef.current) clearTimeout(partnerTimeoutRef.current);
          if (data.is_typing) {
            partnerTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 4000);
          }
        }
      })
      .subscribe((status) => {
        console.log("[typing] broadcast channel status:", status);
      });

    // Polling fallback every 2s
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("typing_status")
        .select("is_typing, updated_at")
        .neq("user_id", userId)
        .maybeSingle();
      if (data) {
        // Only trust if updated_at is recent (within 5 seconds)
        const updatedAt = new Date(data.updated_at ?? 0).getTime();
        const isRecent = Date.now() - updatedAt < 5000;
        setPartnerTyping(isRecent && (data.is_typing ?? false));
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (partnerTimeoutRef.current) clearTimeout(partnerTimeoutRef.current);
    };
  }, [userId]);

  return { partnerTyping, handleTyping, setTyping };
}
