import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useTreeGrowth — one number: how many messages the two of you have sent.
 *
 * This is deliberately the *cheapest* possible way to ask. The old forest page
 * paged through every message in the table, 200 rows at a time, downloading the
 * text of each one just to count them. A counting query asks the database to
 * count and returns a single number — one request, no rows, and it stays one
 * request whether you have 50 messages or 50,000.
 */
export function useTreeGrowth(userId: string | undefined) {
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { count, error: err } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true });

    if (!mounted.current) return;
    if (err) setError(err.message);
    else setTotalMessages(count ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return { totalMessages, loading, error, refresh: load };
}
