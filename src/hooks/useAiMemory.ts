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
}

/**
 * Shared memory store about both partners. Facts are captured manually
 * ("Remember this") or extracted from chat via the ai-memory-extract function.
 */
export function useAiMemory() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("ai_memories")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMemories(data as AiMemory[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

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
      });
      if (!error) fetchMemories();
      return { error };
    },
    [user, fetchMemories],
  );

  const forget = useCallback(
    async (id: string) => {
      await (supabase as any).from("ai_memories").delete().eq("id", id);
      fetchMemories();
    },
    [fetchMemories],
  );

  // Trigger the auto-extraction pass on the server.
  const autoExtract = useCallback(async (partnerId: string | undefined) => {
    const { data, error } = await supabase.functions.invoke("ai-memory-extract", {
      body: { partnerId },
    });
    if (!error) fetchMemories();
    return { added: (data as any)?.added ?? 0, error };
  }, [fetchMemories]);

  return { memories, loading, remember, forget, autoExtract, refetch: fetchMemories };
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
