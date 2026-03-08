import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  content: string | null;
  created_at: string | null;
  username: string | null;
}

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults([]);
      setCurrentIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("messages")
        .select("id, content, created_at, username")
        .ilike("content", `%${q.trim()}%`)
        .order("created_at", { ascending: false })
        .limit(100);
      const r = (data ?? []) as SearchResult[];
      setResults(r);
      setCurrentIndex(r.length > 0 ? 0 : -1);
      setSearching(false);
    }, 350);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < results.length - 1 ? i + 1 : 0));
  }, [results.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : results.length - 1));
  }, [results.length]);

  const currentResult = results[currentIndex] ?? null;

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setCurrentIndex(-1);
  }, []);

  return { results, searching, query, search, clear, currentIndex, goNext, goPrev, currentResult };
}
