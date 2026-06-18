import { supabase } from "@/integrations/supabase/client";

// Thin client for the `ai-game` edge function. Every call DEGRADES GRACEFULLY:
// if the AI is unavailable (not deployed, rate-limited, offline), games keep
// working — word validation defaults to "accept", generation returns null.

/** Validate a word is real. Returns true on any AI failure (never blocks play). */
export async function aiValidateWord(word: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-game", {
      body: { action: "validate_word", word },
    });
    if (error || !data) return { valid: true }; // fail-open
    return { valid: data.valid !== false, reason: data.reason };
  } catch {
    return { valid: true }; // fail-open
  }
}

// Defense-in-depth: even though the prompt forbids it, never surface these.
const BANNED_DRAW = [
  "sex", "kiss", "boob", "breast", "butt", "nude", "naked", "bra", "underwear",
  "condom", "drug", "beer", "wine", "alcohol", "cigarette", "smoke", "weed", "gun",
  "knife", "blood", "kill", "death", "toilet", "poop", "pee", "fart", "bikini",
];

/** Fun, age-appropriate, India-friendly things to draw for Quick Draw.
 *  Returns null on failure so the caller can fall back to its local word bank. */
export async function aiDrawWords(): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-game", {
      body: { action: "draw_words" },
    });
    if (error || !Array.isArray(data?.words)) return null;
    const words = (data.words as string[])
      .map((w) => String(w).toLowerCase().trim())
      .filter((w) => w.length >= 2 && !BANNED_DRAW.some((b) => w.includes(b)));
    return words.length >= 3 ? words : null;
  } catch {
    return null;
  }
}

/** Free-form single-turn ask. Returns null on failure. */
export async function aiAsk(prompt: string, opts?: { system?: string; temperature?: number; maxTokens?: number }): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-game", {
      body: { action: "ask", prompt, ...opts },
    });
    if (error || !data?.text) return null;
    return data.text as string;
  } catch {
    return null;
  }
}
