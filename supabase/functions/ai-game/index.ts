// Generic game-AI endpoint. Uses OpenRouter free models with fallback so a
// single unavailable model never breaks a game. Actions:
//   - validate_word: is this a real word? (Word Chain)
//   - ask: free-form single-turn completion (future games)
// All actions degrade gracefully on the client — if this function is missing or
// errors, the game keeps working without AI.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free models, tried in order until one responds.
const FREE_MODELS = [
  "nex-agi/nex-n2-pro:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

async function callOpenRouter(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  let lastErr: Error | null = null;
  for (const model of FREE_MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsofyou.app",
          "X-Title": "NewsOfYou Games",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 200,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.length > 0) return text;
        lastErr = new Error("Empty response");
        continue;
      }
      if (res.status === 402) throw new Error("AI credits exhausted");
      // 429 / 404 / 503 / others → try next model
      lastErr = new Error(`Model ${model} unavailable (${res.status})`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error("fetch failed");
    }
  }
  throw lastErr ?? new Error("All models failed");
}

function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch { return null; } }
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...payload } = await req.json();

    if (action === "validate_word") {
      const word = String(payload.word ?? "").trim().toLowerCase();
      if (!word || !/^[a-z]{2,}$/.test(word)) return json({ valid: false, reason: "Letters only, 2+ characters" });

      const text = await callOpenRouter(
        [
          { role: "system", content: "You are a strict but fair English dictionary. Decide if the given token is a real English word (common nouns, verbs, adjectives, adverbs, well-known plurals and proper nouns count; abbreviations, slang spellings and gibberish do not). Reply ONLY with JSON: {\"valid\": true|false}." },
          { role: "user", content: `Word: "${word}"` },
        ],
        { json: true, maxTokens: 20, temperature: 0 },
      );
      const parsed = parseJsonLoose<{ valid: boolean }>(text);
      return json({ valid: parsed?.valid ?? true });
    }

    if (action === "draw_words") {
      const DRAW_SYS =
        "You generate words for a Pictionary-style drawing game. The players are friends in India, aged 17–18. " +
        "Produce items that are FUN, a little funny, and easy to doodle. Mix everyday objects, animals, food, nature, " +
        "and light Indian daily-life / pop-culture references (e.g. samosa, auto rickshaw, chai, cricket bat, momos, " +
        "scooter, kite, peacock, jalebi, school bag). " +
        "Keep EVERYTHING wholesome and family-friendly. STRICTLY AVOID anything romantic, sexual, crude, body-part, " +
        "toilet, alcohol, drugs, violence, gore, politics, religion-sensitive, caste, or otherwise embarrassing. " +
        "No names of real people. Each entry is 1–3 simple words, lowercase. " +
        'Return ONLY JSON: {"words": ["...", ...]}.';
      const text = await callOpenRouter(
        [
          { role: "system", content: DRAW_SYS },
          { role: "user", content: "Give me 8 fresh, fun, drawable things. Vary easy and medium difficulty." },
        ],
        { json: true, temperature: 1.0, maxTokens: 160 },
      );
      const parsed = parseJsonLoose<{ words: string[] }>(text);
      const BANNED = [
        "sex", "kiss", "boob", "breast", "butt", "ass", "nude", "naked", "bra", "underwear",
        "condom", "drug", "beer", "wine", "alcohol", "cigarette", "smoke", "weed", "gun",
        "knife", "blood", "kill", "death", "toilet", "poop", "pee", "fart", "bikini",
      ];
      let words = Array.isArray(parsed?.words) ? parsed!.words : [];
      words = words
        .map((w) => String(w).toLowerCase().trim())
        .filter((w) => w.length >= 2 && w.length <= 20 && /^[a-z][a-z ]*$/.test(w))
        .filter((w) => !BANNED.some((b) => w.includes(b)));
      return json({ words: [...new Set(words)].slice(0, 8) });
    }

    if (action === "ask") {
      const prompt = String(payload.prompt ?? "");
      const system = String(payload.system ?? "You are a helpful game assistant. Keep replies short.");
      if (!prompt) return json({ text: "" });
      const text = await callOpenRouter(
        [{ role: "system", content: system }, { role: "user", content: prompt }],
        { temperature: payload.temperature ?? 0.7, maxTokens: payload.maxTokens ?? 200 },
      );
      return json({ text: text.trim() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("ai-game error:", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
