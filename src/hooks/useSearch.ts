import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;

export function useSearch() {
  const [results, setResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .ilike("content", `%${q.trim()}%`)
      .order("created_at", { ascending: false })
      .limit(50);
    setResults(data ?? []);
    setSearching(false);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  return { results, searching, query, search, clear };
}
