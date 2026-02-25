import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PendingAnimation {
  id: string;
  animation_type: string;
  animation_data: any;
  sender_name: string | null;
}

export function useAnimationQueue(userId: string | undefined) {
  const [queue, setQueue] = useState<PendingAnimation[]>([]);
  const [current, setCurrent] = useState<PendingAnimation | null>(null);
  const processingRef = useRef(false);
  const fetchedRef = useRef(false);

  // Fetch pending animations on mount — delete from DB immediately so they never replay
  useEffect(() => {
    if (!userId || fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchAndClear = async () => {
      const { data } = await supabase
        .from("pending_animations")
        .select("*")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        // Delete ALL fetched animations from DB immediately so reopening chat won't replay
        const ids = data.map((d: any) => d.id);
        await supabase
          .from("pending_animations")
          .delete()
          .in("id", ids);

        setQueue(data as any);
      }
    };
    fetchAndClear();
  }, [userId]);

  // Process queue one by one
  useEffect(() => {
    if (processingRef.current || queue.length === 0 || current) return;
    processingRef.current = true;
    const next = queue[0];
    setCurrent(next);
    setQueue((prev) => prev.slice(1));
  }, [queue, current]);

  const dismiss = useCallback(() => {
    // Already deleted from DB on fetch, just advance the queue
    setCurrent(null);
    processingRef.current = false;
  }, []);

  return { current, dismiss };
}
