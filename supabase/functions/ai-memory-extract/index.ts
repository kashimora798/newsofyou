// ── Inlined shared helpers (was ../_shared/openrouter.ts) ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FREE_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-2-9b-it:free",
];

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function callOpenRouter(
  messages: ChatMessage[],
  opts: CallOptions = {},
): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) throw new AiError(500, "OPENROUTER_API_KEY not configured");

  const models = opts.model ? [opts.model, ...FREE_MODELS] : FREE_MODELS;
  let lastErr: AiError | null = null;

  for (const model of models) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://newsofyou.app",
        "X-Title": "NewsOfYou",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 512,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.length > 0) return text;
      lastErr = new AiError(502, "Empty AI response");
      continue;
    }

    if (res.status === 429 || res.status === 404 || res.status === 503) {
      lastErr = new AiError(res.status, `Model ${model} unavailable (${res.status})`);
      continue;
    }

    if (res.status === 402) throw new AiError(402, "AI credits exhausted");
    throw new AiError(res.status, `OpenRouter error: ${res.status}`);
  }

  throw lastErr ?? new AiError(502, "All AI models failed");
}

function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function requirePartner(
  req: Request,
): Promise<{ userId: string; supabase: any }> {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error } = await anonClient.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (error || !user) throw new AiError(401, "Unauthorized");

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["partner", "admin"].includes(profile.role)) {
    throw new AiError(403, "Not a chat participant");
  }

  return { userId: user.id, supabase: admin };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(e: unknown): Response {
  if (e instanceof AiError) {
    return jsonResponse({ error: e.message }, e.status);
  }
  console.error("AI function error:", e);
  return jsonResponse(
    { error: e instanceof Error ? e.message : "Unknown error" },
    500,
  );
}
// ── end inlined helpers ──

interface ExtractedFact {
  fact: string;
  category: string;   // likes|dislikes|important|date|other
  about: string;      // username the fact is about
}

// Scans recent messages and extracts durable facts about each partner,
// upserting them as source='auto'. Input: { partnerId }. Output: { added }.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, supabase } = await requirePartner(req);
    const { partnerId } = await req.json();

    // Map usernames -> user ids so we can attribute facts to a subject.
    const { data: statuses } = await supabase
      .from("user_status")
      .select("user_id, name");
    const nameToId = new Map<string, string>(
      (statuses ?? [])
        .filter((s: { name: string | null }) => s.name)
        .map((s: { user_id: string; name: string }) => [s.name.toLowerCase(), s.user_id]),
    );

    const { data: recent } = await supabase
      .from("messages")
      .select("username, content")
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(80);

    if (!recent || recent.length === 0) return jsonResponse({ added: 0 });

    const chatLog = recent
      .reverse()
      .map((m: { username: string; content: string }) => `${m.username}: ${m.content}`)
      .join("\n");

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You extract durable personal facts about people from a chat between a couple. " +
          "Only capture lasting facts (preferences, favorites, important people/dates, dislikes) — " +
          "NOT one-off chatter or fleeting moods. " +
          'Reply with ONLY a JSON object: {"facts":[{"fact":"...","category":"likes|dislikes|important|date|other","about":"<the name the fact is about>"}]}. ' +
          "Keep each fact short (max ~12 words). Return at most 8 facts. If nothing durable, return an empty array.",
      },
      { role: "user", content: `Chat:\n${chatLog}` },
    ];

    const raw = await callOpenRouter(messages, { temperature: 0.3, maxTokens: 500, json: true });
    const parsed = parseJsonLoose<{ facts: ExtractedFact[] }>(raw);
    const facts = parsed?.facts ?? [];

    let added = 0;
    for (const f of facts) {
      if (!f.fact || !f.about) continue;
      const subjectId = nameToId.get(f.about.toLowerCase());
      if (!subjectId) continue;

      const category = ["likes", "dislikes", "important", "date", "other"].includes(f.category)
        ? f.category
        : "other";

      // Upsert-on-conflict against the unique (subject, lower(fact)) index.
      const { error } = await supabase.from("ai_memories").insert({
        owner_user_id: userId,
        subject_user_id: subjectId,
        fact: f.fact.slice(0, 200),
        category,
        source: "auto",
        confidence: 0.7,
      });
      if (!error) added++;
    }

    return jsonResponse({ added });
  } catch (e) {
    return errorResponse(e);
  }
});
