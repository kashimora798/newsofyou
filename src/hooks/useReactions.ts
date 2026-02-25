import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Reaction = Tables<"message_reactions">;

export function useReactions(messageIds: string[]) {
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  useEffect(() => {
    if (messageIds.length === 0) return;

    const fetchReactions = async () => {
      const { data } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageIds);
      if (data) {
        const grouped: Record<string, Reaction[]> = {};
        data.forEach((r) => {
          if (!grouped[r.message_id]) grouped[r.message_id] = [];
          grouped[r.message_id].push(r);
        });
        setReactions(grouped);
      }
    };

    fetchReactions();

    const channel = supabase
      .channel("reactions-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_reactions",
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setReactions((prev) => {
            // Deduplicate — don't add if already present
            const existing = prev[r.message_id] ?? [];
            if (existing.some(x => x.user_id === r.user_id && x.emoji === r.emoji)) return prev;
            return { ...prev, [r.message_id]: [...existing, r] };
          });
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as Reaction;
          setReactions((prev) => ({
            ...prev,
            [r.message_id]: (prev[r.message_id] ?? []).filter(
              (x) => !(x.user_id === r.user_id && x.emoji === r.emoji)
            ),
          }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messageIds.join(",")]);

  const toggleReaction = useCallback(async (messageId: string, userId: string, emoji: string) => {
    const existingSame = reactions[messageId]?.find(
      (r) => r.user_id === userId && r.emoji === emoji
    );

    if (existingSame) {
      // Optimistic remove
      setReactions((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? []).filter(
          (x) => !(x.user_id === userId && x.emoji === emoji)
        ),
      }));
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", emoji);
    } else {
      // Remove any existing reaction by this user on this message first
      const existingAny = reactions[messageId]?.find(
        (r) => r.user_id === userId
      );
      if (existingAny) {
        // Optimistic remove old
        setReactions((prev) => ({
          ...prev,
          [messageId]: (prev[messageId] ?? []).filter(
            (x) => !(x.user_id === userId && x.emoji === existingAny.emoji)
          ),
        }));
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId)
          .eq("emoji", existingAny.emoji);
      }

      // Optimistic add new
      const optimistic: Reaction = {
        message_id: messageId,
        user_id: userId,
        emoji,
        created_at: new Date().toISOString(),
      };
      setReactions((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] ?? []).filter(x => x.user_id !== userId), optimistic],
      }));

      await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: userId, emoji });
    }
  }, [reactions]);

  return { reactions, toggleReaction };
}
