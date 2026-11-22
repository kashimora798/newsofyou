import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Reaction = Tables<"message_reactions">;

const isRealId = (id: string) => !id.startsWith("tmp_");
const CHUNK = 80; // keeps the `in (...)` URL comfortably short

export function useReactions(messageIds: string[]) {
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  // Ids whose reactions we've already loaded — we only ever fetch the NEW ones.
  const fetchedRef = useRef<Set<string>>(new Set());

  // Incremental fetch: a new message used to trigger a refetch of every reaction
  // for every loaded message. Now it's one small query for just the new ids.
  const idsKey = messageIds.join(",");
  useEffect(() => {
    const fresh = messageIds.filter((id) => isRealId(id) && !fetchedRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => fetchedRef.current.add(id));

    (async () => {
      for (let i = 0; i < fresh.length; i += CHUNK) {
        const { data } = await supabase
          .from("message_reactions")
          .select("*")
          .in("message_id", fresh.slice(i, i + CHUNK));
        if (data && data.length) {
          setReactions((prev) => {
            const next = { ...prev };
            for (const r of data) {
              const list = next[r.message_id] ?? [];
              if (!list.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) {
                next[r.message_id] = [...list, r];
              }
            }
            return next;
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // One realtime subscription for the lifetime of the chat (was re-created per message).
  useEffect(() => {
    const channel = supabase
      .channel("reactions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setReactions((prev) => {
            const existing = prev[r.message_id] ?? [];
            if (existing.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return prev;
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
  }, []);

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
