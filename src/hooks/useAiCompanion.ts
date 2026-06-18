import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GuardVerdict {
  risk: "low" | "medium" | "high";
  reason: string;
  softer_rewrite: string;
}

export interface CompanionReaction {
  tone: "sweet" | "neutral" | "hurtful";
  reaction: string;
}

/**
 * Opt-in AI helpers for messages:
 *  - guard:   check a draft before sending (might it hurt?)
 *  - companion: react to a received message (praise / console)
 */
export function useAiCompanion() {
  const checkDraft = useCallback(async (draft: string): Promise<GuardVerdict | null> => {
    const { data, error } = await supabase.functions.invoke("ai-message-guard", {
      body: { draft },
    });
    if (error || (data as any)?.error) return null;
    return data as GuardVerdict;
  }, []);

  const reactToMessage = useCallback(async (text: string): Promise<CompanionReaction | null> => {
    const { data, error } = await supabase.functions.invoke("ai-companion", {
      body: { text },
    });
    if (error || (data as any)?.error) return null;
    return data as CompanionReaction;
  }, []);

  return { checkDraft, reactToMessage };
}
