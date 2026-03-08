import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type PinnedMessage = Tables<"pinned_messages"> & {
  message?: Tables<"messages"> | null;
};

export function usePinnedMessages() {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPinned = useCallback(async () => {
    const { data } = await supabase
      .from("pinned_messages")
      .select("*, message:messages(*)")
      .order("created_at", { ascending: false });

    if (data) {
      setPinnedMessages(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPinned();

    const channel = supabase
      .channel("pinned-messages-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pinned_messages",
      }, () => {
        fetchPinned();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPinned]);

  const pinMessage = useCallback(async (messageId: string, userId: string) => {
    const { error } = await supabase
      .from("pinned_messages")
      .insert({ message_id: messageId, pinned_by: userId });
    return error;
  }, []);

  const unpinMessage = useCallback(async (messageId: string, userId: string) => {
    const { error } = await supabase
      .from("pinned_messages")
      .delete()
      .eq("message_id", messageId)
      .eq("pinned_by", userId);
    return error;
  }, []);

  const isMessagePinned = useCallback((messageId: string) => {
    return pinnedMessages.some(p => p.message_id === messageId);
  }, [pinnedMessages]);

  return { pinnedMessages, loading, pinMessage, unpinMessage, isMessagePinned };
}
