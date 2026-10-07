import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MemoryCategory = "likes" | "dislikes" | "important" | "date" | "other";

export interface AiMemory {
  id: string;
  owner_user_id: string;
  subject_user_id: string;
  fact: string;
  category: MemoryCategory;
  source: "manual" | "auto";
  confidence: number;
  created_at: string;
  /** Phase 5 — memory 2.0 */
  pinned: boolean;
  archived: boolean;
  importance: number;
  seen_count: number;
  last_seen_at: string | null;
  updated_at: string;
  day: string | null;
  message_id: string | null;
  kind: string | null;
}

/** A line the twin decided was worth keeping (message_highlights). */
export interface MemoryHighlight {
  id: string;
  day: string;
  kind: string;
  text: string;
  score: number;
  source: string;
  message_id: string | null;
}

export interface MemoryStats {
  total?: number;
  pinned?: number;
  manual?: number;
  auto?: number;
  highlights?: number;
  highlights_7d?: number;
  last_run?: {
    ran_at?: string;
    days?: number;
    highlights?: number;
    facts_heuristic?: number;
    facts_llm?: number;
    llm_calls?: number;
    tokens?: number;
    note?: string;
  } | null;
}

/**
 * Shared memory store about both partners (Phase 5 — memory 2.0).
 *
 *   - pinned facts always come first, then the important ones;
 *   - "remember this" is still a plain insert (a person typed it, `manual`);
 *   - the extraction pass is now heuristics-first on the server, so tapping it
 *     no longer costs a model call unless something genuinely warrants one;
 *   - pin / forget / search / stats all go through guarded RPCs.
 */
export function useAiMemory() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [highlights, setHighlights] = useState<MemoryHighlight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("ai_memories")
      .select("*")
      .eq("archived", false)
      .order("pinned", { ascending: false })
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setMemories(data as AiMemory[]);
    setLoading(false);
  }, []);

  const fetchMeta = useCallback(async () => {
    const [{ data: s }, { data: h }] = await Promise.all([
      (supabase.rpc as any)("twin_memory_stats"),
      (supabase.rpc as any)("twin_highlights_recent", { p_limit: 12 }),
    ]);
    setStats((s as MemoryStats) ?? null);
    setHighlights(((h ?? []) as MemoryHighlight[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchMemories();
    void fetchMeta();
  }, [fetchMemories, fetchMeta]);

  // Manually remember a fact about someone (defaults to the partner).
  const remember = useCallback(
    async (fact: string, subjectUserId: string, category: MemoryCategory = "other") => {
      if (!user) return { error: new Error("Not signed in") };
      const { error } = await (supabase as any).from("ai_memories").insert({
        owner_user_id: user.id,
        subject_user_id: subjectUserId,
        fact: fact.slice(0, 200),
        category,
        source: "manual",
        confidence: 1.0,
        importance: 0.9,
      });
      if (!error) fetchMemories();
      return { error };
    },
    [user, fetchMemories],
  );

  const forget = useCallback(
    async (id: string) => {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      await (supabase.rpc as any)("twin_memory_forget", { p_id: id });
      void fetchMeta();
    },
    [fetchMeta],
  );

  /** Pinning is a person's judgement — it survives every future sweep. */
  const pin = useCallback(
    async (id: string, pinned = true) => {
      setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, pinned } : m)));
      await (supabase.rpc as any)("twin_memory_pin", { p_id: id, p_pinned: pinned });
      await fetchMemories();
      void fetchMeta();
    },
    [fetchMemories, fetchMeta],
  );

  /** Only what relates to a phrase — the same search the twin's prompt uses. */
  const search = useCallback(async (query: string, subjectUserId?: string) => {
    const { data } = await (supabase.rpc as any)("twin_memory_search", {
      p_query: query || null,
      p_subject: subjectUserId ?? null,
      p_limit: 30,
    });
    return (data ?? []) as (AiMemory & { sim: number })[];
  }, []);

  // Trigger the extraction pass on the server (heuristics first, ≤1 model call).
  const autoExtract = useCallback(
    async (partnerId: string | undefined) => {
      const { data, error } = await supabase.functions.invoke("ai-memory-extract", {
        body: { partnerId },
      });
      if (!error) {
        void fetchMemories();
        void fetchMeta();
      }
      return {
        added: (data as any)?.added ?? 0,
        highlights: (data as any)?.highlights ?? 0,
        llmCalls: (data as any)?.llm_calls ?? 0,
        error,
      };
    },
    [fetchMemories, fetchMeta],
  );

  /** The nightly sweep over a window of days (free unless it asks the model). */
  const runNightly = useCallback(
    async (days = 7, force = false) => {
      const { data, error } = await supabase.functions.invoke("twin-nightly", { body: { days, force } });
      if (!error) {
        void fetchMemories();
        void fetchMeta();
      }
      return { result: data as any, error };
    },
    [fetchMemories, fetchMeta],
  );

  return {
    memories,
    stats,
    highlights,
    loading,
    remember,
    forget,
    pin,
    search,
    autoExtract,
    runNightly,
    refetch: fetchMemories,
    refetchMeta: fetchMeta,
  };
}

/** Ask the assistant to improve a draft message to the partner. */
export async function fetchComposeHelp(draft: string, partnerId: string | undefined) {
  const { data, error } = await supabase.functions.invoke("ai-compose-help", {
    body: { draft, partnerId },
  });
  if (error) return { suggestion: null as string | null, error };
  if ((data as any)?.error) return { suggestion: null as string | null, error: new Error((data as any).error) };
  return { suggestion: ((data as any)?.suggestion ?? null) as string | null, error: null };
}
