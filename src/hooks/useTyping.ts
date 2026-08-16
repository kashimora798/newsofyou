import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Uses Supabase Broadcast for instant typing / recording indicators (no DB latency).
 * Falls back to polling typing_status table for reliability.
 */
export function useTyping(userId: string | undefined, username: string | undefined) {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const partnerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Send status via Broadcast (instant, 0 DB latency)
  const broadcastStatus = useCallback((isTyping: boolean, isRecording = false) => {
    if (!userId) return;
    try {
      supabase.channel("typing-broadcast").send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: userId, username, is_typing: isTyping, is_recording: isRecording },
      });
    } catch {}
  }, [userId, username]);

  // Persist status to DB with safe error handling
  const persistStatus = useCallback(async (isTyping: boolean, isRecording = false) => {
    if (!userId || !username) return;
    try {
      await supabase.from("typing_status").upsert({
        user_id: userId,
        username,
        is_typing: isTyping,
        is_recording: isRecording,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch {}
  }, [userId, username]);

  // Called when typing in text input
  const handleTyping = useCallback(() => {
    broadcastStatus(true, false);
    void persistStatus(true, false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      broadcastStatus(false, false);
      void persistStatus(false, false);
    }, 3000);
  }, [broadcastStatus, persistStatus]);

  // Called when voice recording starts / stops
  const handleRecording = useCallback((isRecording: boolean) => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    broadcastStatus(false, isRecording);
    void persistStatus(false, isRecording);
  }, [broadcastStatus, persistStatus]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    broadcastStatus(isTyping, false);
    await persistStatus(isTyping, false);
  }, [broadcastStatus, persistStatus]);

  useEffect(() => {
    if (!userId) return;

    // Listen for broadcast typing & recording events (instant)
    const channel = supabase
      .channel("typing-broadcast")
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload;
        if (data && data.user_id !== userId) {
          const typing = Boolean(data.is_typing);
          const recording = Boolean(data.is_recording);
          setPartnerTyping(typing);
          setPartnerRecording(recording);

          if (partnerTimeoutRef.current) clearTimeout(partnerTimeoutRef.current);
          if (typing || recording) {
            // Auto-clear after 4s if no heartbeat
            partnerTimeoutRef.current = setTimeout(() => {
              setPartnerTyping(false);
              setPartnerRecording(false);
            }, 4000);
          }
        }
      })
      .subscribe();

    // Polling fallback every 2s
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("typing_status")
          .select("is_typing, is_recording, updated_at")
          .neq("user_id", userId)
          .maybeSingle();

        if (data) {
          const updatedAt = new Date(data.updated_at ?? 0).getTime();
          const isRecent = Date.now() - updatedAt < 5000;
          if (isRecent) {
            setPartnerTyping(Boolean(data.is_typing));
            setPartnerRecording(Boolean((data as any).is_recording));
          } else {
            setPartnerTyping(false);
            setPartnerRecording(false);
          }
        }
      } catch {}
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (partnerTimeoutRef.current) clearTimeout(partnerTimeoutRef.current);
    };
  }, [userId]);

  return { partnerTyping, partnerRecording, handleTyping, handleRecording, setTyping };
}
