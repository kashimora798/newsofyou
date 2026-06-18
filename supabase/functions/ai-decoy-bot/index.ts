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

// A genuinely-working AI assistant for the decoy disguise. Looks like a real
// AI app to any onlooker. Input: { messages: [{role, content}], persona }.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requirePartner(req);
    const { messages, persona } = await req.json();

    const personaName =
      persona === "gemini" ? "Gemini" : persona === "claude" ? "Claude" : "ChatGPT";

    const convo: ChatMessage[] = [
      {
        role: "system",
        content:
          `You are ${personaName}, a helpful, knowledgeable general-purpose AI assistant. ` +
          "Answer normally and helpfully on any topic. Be concise and friendly.",
      },
      ...(Array.isArray(messages) ? messages.slice(-12) : []),
    ];

    const reply = (await callOpenRouter(convo, { temperature: 0.7, maxTokens: 500 })).trim();
    return jsonResponse({ reply });
  } catch (e) {
    return errorResponse(e);
  }
});
