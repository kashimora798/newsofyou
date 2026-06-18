import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type SearchResult = Tables<"messages">;

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const term = q.trim();
      // Match the text content, link metadata and file names so image/link/file
      // messages surface too — not just plain text.
      const escaped = term.replace(/[%_,]/g, (m) => `\\${m}`);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          [
            `content.ilike.%${escaped}%`,
            `link_title.ilike.%${escaped}%`,
            `link_description.ilike.%${escaped}%`,
            `file_name.ilike.%${escaped}%`,
          ].join(","),
        )
        .order("created_at", { ascending: false })
        .limit(100);
      setResults((data ?? []) as SearchResult[]);
      setSearching(false);
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  return { results, searching, query, search, clear };
}
