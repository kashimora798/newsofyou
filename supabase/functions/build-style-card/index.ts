// Phase 1E — build the twin's style card (one-time, human-reviewed).
//
//   POST {}  →  { card, stats, exemplars, model }
//
// Owner-only. Free statistics are computed locally; ONE private LLM call then
// turns the measurements + ~60 real reply pairs into a ≤400-word style card,
// which is stored in `twin_style_card` where the owner can edit it. The twin
// always uses the stored (possibly edited) version.
//
// Nothing writes to `messages`.

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/style.ts) ──
// ── BEGIN INLINE: style.ts ──
/** Words that say nothing about style (English + Hinglish particles). */
const STYLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did", "doing", "done",
  "have", "has", "had", "i", "i'm", "im", "you", "you're", "your", "yours", "u", "ur", "he", "she",
  "it", "its", "we", "they", "me", "my", "mine", "our", "us", "him", "her", "them", "to", "of",
  "in", "on", "at", "for", "with", "from", "by", "as", "so", "not", "no", "yes", "ok", "okay",
  "just", "very", "too", "also", "will", "would", "can", "could", "should", "shall", "may", "might",
  "there", "here", "what", "when", "where", "who", "why", "how", "all", "any", "some", "one", "two",
  "get", "got", "go", "going", "went", "come", "coming", "came", "know", "think", "want", "need",
  "like", "really", "much", "more", "now", "out", "up", "down", "about", "because", "pls", "please",
  "hai", "hain", "ho", "hoga", "ka", "ki", "ke", "ko", "se", "me", "mein", "bhi", "toh", "to", "na",
  "kya", "kyun", "kaise", "kar", "karo", "karna", "raha", "rahi", "rahe", "tha", "thi", "the",
  "tum", "tu", "main", "mai", "hum", "acha", "achha", "theek", "thik", "yaar", "yr", "abhi", "ab",
  "aur", "ek", "koi", "kuch", "nahi", "nhi", "haan", "han", "mat", "bas", "kaafi", "bahut", "bht",
]);

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2764}]/u;

/**
 * Emoji as grapheme clusters, so "❤️" counts once (the variation selector is
 * not a separate emoji). Uses Intl.Segmenter when available, with a regex
 * fallback that merges trailing variation selectors.
 */
function extractEmojis(text: string): string[] {
  const segmenter = (Intl as { Segmenter?: new (locale?: string, opts?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (segmenter) {
    try {
      const seg = new segmenter(undefined, { granularity: "grapheme" });
      const out: string[] = [];
      for (const part of seg.segment(text)) {
        const g = part.segment;
        if (EMOJI_RE.test(g.replace(/\u{FE0F}/u, ""))) out.push(g.replace(/\u{FE0F}/u, "") + (g.includes("\u{FE0F}") ? "\u{FE0F}" : ""));
      }
      return out;
    } catch {
      /* fall through to regex */
    }
  }
  return text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?/gu) ?? [];
}
const HINGLISH_MARKERS =
  /\b(hai|hain|nahi|nhi|kya|tum|tu|main|mai|hum|bhi|toh|yaar|acha|achha|theek|thik|bahut|bht|kaafi|mat|bas|abhi|phir|fir|kyun|kaise|karo|raha|rahi|dil|pyar|pyaar|jaan|soya|khana|khaana|ghar|kaam|kal|aaj|subah|raat|din|baat)\b/gi;
const LAUGH_PATTERNS: [string, RegExp][] = [
  ["haha", /\bha(?:ha)+h?\b/gi],
  ["hehe", /\bhe(?:he)+\b/gi],
  ["lol", /\blol+\b/gi],
  ["emoji_joy", /😂|🤣/g],
];

interface StyleStats {
  total_messages: number;
  avg_chars: number;
  median_chars: number;
  p90_chars: number;
  top_words: { word: string; n: number }[];
  top_openers: { word: string; n: number }[];
  top_closers: { word: string; n: number }[];
  emojis: { emoji: string; n: number }[];
  laugh_styles: { style: string; n: number }[];
  hinglish_ratio: number;
  pet_names: { name: string; n: number }[];
  exclamation_ratio: number;
  question_ratio: number;
  messages_per_daypart: { daypart: string; n: number }[];
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']{2,}/g) ?? []).filter((w) => w.length > 2);
}

/** Top-N helper that keeps the result stable and small. */
function topN(counts: Map<string, number>, n: number, min = 1): { word: string; n: number }[] {
  return [...counts.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([word, count]) => ({ word, n: count }));
}

function daypartOf(iso: string, timezoneOffsetHours = 5.5): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const hour = new Date(t + timezoneOffsetHours * 3600 * 1000).getUTCHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/**
 * Measure how someone writes from their own sent messages.
 * `nicknames` = the names they use for the other person (from twin_config).
 */
function computeStyleStats(
  messages: { content: string; created_at: string }[],
  nicknames: string[] = [],
): StyleStats {
  const words = new Map<string, number>();
  const openers = new Map<string, number>();
  const closers = new Map<string, number>();
  const emojis = new Map<string, number>();
  const laughs = new Map<string, number>();
  const pets = new Map<string, number>();
  const dayparts = new Map<string, number>();
  const lengths: number[] = [];
  let hinglishHits = 0;
  let tokens = 0;
  let exclamations = 0;
  let questions = 0;

  const nicknameSet = new Set(nicknames.map((n) => n.toLowerCase()).filter(Boolean));

  for (const m of messages ?? []) {
    const content = (m?.content ?? "").trim();
    if (!content) continue;
    lengths.push(content.length);
    if (content.includes("!")) exclamations++;
    if (content.includes("?")) questions++;

    const toks = tokenize(content);
    tokens += toks.length;
    hinglishHits += (content.match(HINGLISH_MARKERS) ?? []).length;

    for (const w of toks) {
      if (STYLE_STOPWORDS.has(w)) continue;
      words.set(w, (words.get(w) ?? 0) + 1);
      if (nicknameSet.has(w)) pets.set(w, (pets.get(w) ?? 0) + 1);
    }

    const first = toks[0];
    if (first) openers.set(first, (openers.get(first) ?? 0) + 1);
    const rawLast = (content.toLowerCase().match(/[a-z']{2,}/g) ?? []).pop();
    if (rawLast) closers.set(rawLast, (closers.get(rawLast) ?? 0) + 1);

    for (const e of extractEmojis(content)) emojis.set(e, (emojis.get(e) ?? 0) + 1);
    for (const [style, re] of LAUGH_PATTERNS) {
      const n = (content.match(re) ?? []).length;
      if (n > 0) laughs.set(style, (laughs.get(style) ?? 0) + n);
    }

    const dp = daypartOf(m?.created_at ?? "");
    dayparts.set(dp, (dayparts.get(dp) ?? 0) + 1);
  }

  const adaptiveMin = lengths.length >= 50 ? 3 : 1;
  const sorted = [...lengths].sort((a, b) => a - b);
  const at = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);

  return {
    total_messages: lengths.length,
    avg_chars: sorted.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
    median_chars: at(0.5),
    p90_chars: at(0.9),
    top_words: topN(words, 40, adaptiveMin),
    top_openers: topN(openers, 12, 1),
    top_closers: topN(closers, 12, 1),
    emojis: topN(new Map([...emojis.entries()].map(([k, v]) => [k, v])), 15, 1).map((e) => ({ emoji: e.word, n: e.n })),
    laugh_styles: topN(laughs, 6, 1).map((l) => ({ style: l.word, n: l.n })),
    hinglish_ratio: tokens > 0 ? Number((hinglishHits / tokens).toFixed(3)) : 0,
    pet_names: topN(pets, 8, 1).map((p) => ({ name: p.word, n: p.n })),
    exclamation_ratio: lengths.length ? Number((exclamations / lengths.length).toFixed(2)) : 0,
    question_ratio: lengths.length ? Number((questions / lengths.length).toFixed(2)) : 0,
    messages_per_daypart: [...dayparts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([daypart, n]) => ({ daypart, n })),
  };
}

/**
 * Prompt for the style card: measurements + real reply pairs, asking for a
 * short, editable voice profile. Kept here so the wording is versioned.
 */
function buildStylePrompt(
  stats: StyleStats,
  pairs: { partner_text: string; owner_reply: string; tone?: string | null }[],
  names: { ownerName: string; partnerName: string },
): { system: string; user: string } {
  const exemplars = (pairs ?? [])
    .slice(0, 60)
    .map((p, i) => `${i + 1}. [${p.tone ?? "other"}] She: ${p.partner_text}\n   He replied: ${p.owner_reply}`)
    .join("\n");

  return {
    system:
      `You analyse how ${names.ownerName} writes to ${names.partnerName} and produce a STYLE CARD that a small AI ` +
      `will use to imitate him. Be concrete and specific: quote his real phrases. ` +
      `Max 400 words. Use these headings exactly: VOICE, HOW HE OPENS, HOW HE CLOSES, FAVOURITE PHRASES, ` +
      `BY MOOD (sweet / playful / flirty / caring / serious / sorry), DO, DON'T, EMOJI & LAUGH STYLE, HINGLISH. ` +
      `Do not invent facts, do not include anything private that is not needed for tone, and never include ` +
      `phone numbers, addresses or links. Output plain text only (no JSON, no markdown headers beyond the words above).`,
    user:
      `MEASUREMENTS (from ${stats.total_messages} of his messages):\n` +
      `${JSON.stringify(stats, null, 1)}\n\n` +
      `REAL EXAMPLES of her message and his actual reply:\n${exemplars || "(none yet)"}\n\n` +
      `Write the style card.`,
  };
}
// ── END INLINE: style.ts ──
// ── END GENERATED BLOCK ──

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/llm.ts) ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ChatRole = "system" | "user" | "assistant";
type Sensitivity = "private" | "low";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface LlmCallOptions {
  messages: ChatMessage[];
  /** "private" (default) or "low". Chooses which providers may see the text. */
  sensitivity?: Sensitivity;
  /** Routing profile. Default: "chat". */
  task?: string;
  temperature?: number;
  /** Hard cap on generated tokens (also clamped by the task profile). */
  maxTokens?: number;
  json?: boolean;
  /** Force one provider:model from the route list. */
  model?: string;
  /** Only these providers may be used. */
  providers?: string[];
  /** Cache TTL in seconds. Ignored unless sensitivity is "low". */
  ttlSeconds?: number;
  /** Extra salt so two prompts can never collide in the cache. */
  cacheKey?: string;
  /** Enables daily-budget accounting + degradation. */
  userId?: string;
  /** "soft" (default) degrades, "strict" throws once the budget is blown. */
  budgetMode?: "soft" | "strict";
  timeoutMs?: number;
  /** Free-form label for logs/admin, e.g. "hangman-hint". */
  tag?: string;
  /** Override the task input budget (in approx. tokens). */
  trimTo?: number;
  /** Personal prompts are never cached. Implied by "private". */
  personal?: boolean;
  /** Redact phone numbers / emails / links before sending. Default true. */
  redactPii?: boolean;
}

interface LlmResult {
  text: string;
  provider: string;
  model: string;
  cached: boolean;
  degraded: boolean;
  attempts: number;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AiError";
  }
}

/** Thrown when every provider failed — callers MUST have a non-AI fallback. */
class AiUnavailable extends AiError {
  attempts: number;
  constructor(message: string, attempts: number) {
    super(503, message);
    this.name = "AiUnavailable";
    this.attempts = attempts;
  }
}

// ── tiny env/util helpers ─────────────────────────────────────────────────

function envGet(key: string): string | undefined {
  try {
    const d = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno;
    const v = d?.env?.get(key);
    return v && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new AiError(504, `${label} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function messageTokens(m: ChatMessage): number {
  return estimateTokens(m.content ?? "") + 4;
}

/**
 * Token conservation step 1: keep the system prompt + as much recent
 * conversation as the budget allows. Oversized single messages are truncated
 * instead of dropped so the caller's latest intent always survives.
 */
function trimMessages(
  messages: ChatMessage[],
  maxInputTokens: number,
): { messages: ChatMessage[]; tokens: number; trimmed: boolean } {
  const safe = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.content === "string")
    .map((m) => ({
      role: (["system", "user", "assistant"].includes(m.role) ? m.role : "user") as ChatRole,
      content: m.content,
    }));

  if (safe.length === 0) return { messages: [], tokens: 0, trimmed: false };

  const systems = safe.filter((m) => m.role === "system");
  const rest = safe.filter((m) => m.role !== "system");
  let budget = Math.max(64, maxInputTokens) - systems.reduce((n, m) => n + messageTokens(m), 0);

  const kept: ChatMessage[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i];
    const cost = messageTokens(m);
    if (cost <= budget) {
      kept.unshift(m);
      budget -= cost;
      continue;
    }
    if (kept.length === 0) {
      const room = Math.max(48, (budget - 4) * 4);
      kept.unshift({ role: m.role, content: m.content.slice(0, room) + "\n…[truncated]" });
      budget = 0;
    }
    break;
  }

  const dropped = rest.length - kept.length;
  const out = [
    ...systems,
    ...(dropped > 0
      ? [{ role: "system" as ChatRole, content: `[${dropped} earlier message(s) omitted]` }]
      : []),
    ...kept,
  ];
  return { messages: out, tokens: out.reduce((n, m) => n + messageTokens(m), 0), trimmed: dropped > 0 };
}

/** Keeps client-supplied history from injecting system instructions. */
function sanitizeHistory(raw: unknown, max = 12): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-max)
    .map((m) => {
      const role = (m as { role?: string })?.role;
      const content = (m as { content?: unknown })?.content;
      return {
        role: (role === "assistant" ? "assistant" : "user") as ChatRole,
        content: typeof content === "string" ? content.slice(0, 4000) : "",
      };
    })
    .filter((m) => m.content.length > 0);
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

/**
 * Context minimisation (build-plan §2.3 #6): strip phone numbers, emails and
 * links before any text leaves the database. Phone matching requires enough
 * digits that ordinary numbers, times and prices survive untouched.
 */
function redact(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, "[email]")
    .replace(/https?:\/\/[^\s<>"')]+/gi, "[link]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, (raw) => {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) return raw;
      // Keep dates/times/amounts: 2026-10-02, 12:30, 1,200, 99.50
      if (/^\s*\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
      return "[number]";
    });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(e: unknown): Response {
  if (e instanceof AiError) return jsonResponse({ error: e.message }, e.status);
  console.error("AI function error:", e);
  return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
}

// ── provider + route config (inlined from _shared/models.ts) ───────────────
// ── BEGIN INLINE: models.ts ──
type ProviderId = "groq" | "cerebras" | "cloudflare" | "gemini" | "openrouter";

interface ProviderDef {
  id: ProviderId;
  label: string;
  /** Empty here = resolved specially (Cloudflare needs an account id). */
  baseUrl: string;
  /** First env var that is set wins. */
  keyEnv: string[];
  /** Extra env var required for the URL to resolve (Cloudflare account id). */
  extraEnv?: string[];
  /** May this provider receive `sensitivity: "private"` content? */
  noTrain: boolean;
  /** Human note shown in error messages / admin. */
  note: string;
}

const PROVIDERS: Record<ProviderId, ProviderDef> = {
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: ["GROQ_API_KEY"],
    noTrain: true, // VERIFY Groq's current data-use terms before trusting this.
    note: "fast, generous free tier",
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyEnv: ["CEREBRAS_API_KEY"],
    noTrain: true, // VERIFY Cerebras' current data-use terms.
    note: "large free daily token allowance",
  },
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    baseUrl: "cloudflare", // resolved from CF_ACCOUNT_ID at call time
    keyEnv: ["CF_API_TOKEN", "CLOUDFLARE_API_TOKEN"],
    extraEnv: ["CF_ACCOUNT_ID"],
    noTrain: true, // VERIFY Cloudflare's current Workers AI data-use terms.
    note: "10k neurons/day; also hosts bge-m3 embeddings",
  },
  gemini: {
    id: "gemini",
    label: "Google AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"],
    noTrain: false, // Free tier may be used to improve Google products (plan §2.1).
    note: "free tier — never used for private content",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: ["OPENROUTER_API_KEY"],
    noTrain: false, // Community `:free` models have varying data policies.
    note: "last-resort fallback for low-sensitivity text only",
  },
};

interface Route {
  provider: ProviderId;
  model: string;
}

/** Ordered fallback chain per task. First entry is the preferred model. */
const ROUTES: Record<string, Route[]> = {
  // ── plan tasks ──────────────────────────────────────────────────────────
  twin_chat: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  ],
  assist: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  ],
  twin_autoreply: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  ],
  face_to_face: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  ],
  greeting: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
  summary: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  ],
  extract: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
  guard: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],

  // ── existing app tasks (keep old call sites working) ────────────────────
  chat: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
  companion: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  ],
  classify: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
  json: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
  hint: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
  decoy: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  ],

  // ── low-sensitivity only: providers with noTrain:false may be used ──────
  game: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "gemini", model: "gemini-2.0-flash-lite" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
  daily_question: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "gemini", model: "gemini-2.0-flash-lite" },
    { provider: "cerebras", model: "llama3.1-8b" },
    { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" },
    { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
  ],
};

/**
 * Merge `LLM_ROUTES_JSON` (or `LLM_ROUTES_<TASK>`) over the defaults so model
 * ids can be fixed without a redeploy of the code.
 */
function routesOverride(rawJson: string | undefined, task: string): Route[] | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as Record<string, Route[]>;
    const routes = parsed[task];
    if (!Array.isArray(routes) || routes.length === 0) return null;
    return routes.filter((r) => r && typeof r.provider === "string" && typeof r.model === "string");
  } catch {
    return null;
  }
}

/** Providers that may receive private content (plan §2.2). */
function privateProviderIds(): ProviderId[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => PROVIDERS[id].noTrain);
}
// ── END INLINE: models.ts ──

// ── task profiles (temperature / caps / budgets) ──────────────────────────

interface TaskProfile {
  temperature: number;
  maxTokens: number;
  json: boolean;
  maxInputTokens: number;
  cacheTtlSeconds: number;
  timeoutMs: number;
  sensitivity: Sensitivity;
}

const TASK_PROFILES: Record<string, TaskProfile> = {
  // plan tasks
  twin_chat: { temperature: 0.85, maxTokens: 300, json: true, maxInputTokens: 3500, cacheTtlSeconds: 0, timeoutMs: 25000, sensitivity: "private" },
  twin_autoreply: { temperature: 0.9, maxTokens: 220, json: true, maxInputTokens: 3000, cacheTtlSeconds: 0, timeoutMs: 22000, sensitivity: "private" },
  face_to_face: { temperature: 0.5, maxTokens: 500, json: true, maxInputTokens: 3500, cacheTtlSeconds: 0, timeoutMs: 30000, sensitivity: "private" },
  greeting: { temperature: 0.9, maxTokens: 160, json: false, maxInputTokens: 1200, cacheTtlSeconds: 0, timeoutMs: 15000, sensitivity: "private" },
  summary: { temperature: 0.5, maxTokens: 340, json: false, maxInputTokens: 4000, cacheTtlSeconds: 0, timeoutMs: 25000, sensitivity: "private" },
  assist: { temperature: 0.3, maxTokens: 340, json: true, maxInputTokens: 1500, cacheTtlSeconds: 0, timeoutMs: 20000, sensitivity: "private" },
  extract: { temperature: 0.3, maxTokens: 500, json: true, maxInputTokens: 3000, cacheTtlSeconds: 0, timeoutMs: 25000, sensitivity: "private" },
  guard: { temperature: 0.3, maxTokens: 300, json: true, maxInputTokens: 1500, cacheTtlSeconds: 0, timeoutMs: 15000, sensitivity: "private" },
  // existing app tasks
  companion: { temperature: 0.7, maxTokens: 260, json: true, maxInputTokens: 1500, cacheTtlSeconds: 0, timeoutMs: 18000, sensitivity: "private" },
  chat: { temperature: 0.7, maxTokens: 320, json: false, maxInputTokens: 3000, cacheTtlSeconds: 0, timeoutMs: 25000, sensitivity: "private" },
  classify: { temperature: 0, maxTokens: 40, json: true, maxInputTokens: 1000, cacheTtlSeconds: 86400, timeoutMs: 12000, sensitivity: "private" },
  json: { temperature: 0.4, maxTokens: 400, json: true, maxInputTokens: 2500, cacheTtlSeconds: 0, timeoutMs: 20000, sensitivity: "private" },
  hint: { temperature: 0.9, maxTokens: 80, json: false, maxInputTokens: 800, cacheTtlSeconds: 0, timeoutMs: 12000, sensitivity: "private" },
  decoy: { temperature: 0.7, maxTokens: 500, json: false, maxInputTokens: 3000, cacheTtlSeconds: 0, timeoutMs: 30000, sensitivity: "private" },
  // generic / low-sensitivity
  game: { temperature: 0.7, maxTokens: 400, json: false, maxInputTokens: 1500, cacheTtlSeconds: 0, timeoutMs: 15000, sensitivity: "low" },
  daily_question: { temperature: 0.9, maxTokens: 60, json: false, maxInputTokens: 800, cacheTtlSeconds: 86400, timeoutMs: 15000, sensitivity: "low" },
};

function profileFor(task: string): TaskProfile {
  return TASK_PROFILES[task] ?? TASK_PROFILES.chat;
}

// ── service client (best effort: the router works with no DB at all) ──────

let _admin: unknown = null;
let _adminTried = false;

async function adminClient(): Promise<{
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): any;
} | null> {
  if (_adminTried) return _admin as never;
  _adminTried = true;
  try {
    const url = envGet("SUPABASE_URL");
    const key = envGet("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    const mod = await import("https://esm.sh/@supabase/supabase-js@2");
    _admin = mod.createClient(url, key, { auth: { persistSession: false } });
  } catch {
    _admin = null;
  }
  return _admin as never;
}

// ── provider resolution ───────────────────────────────────────────────────

interface ProviderHandle {
  def: ProviderDef;
  key: string;
  url: string;
}

function providerHandle(def: ProviderDef): ProviderHandle | null {
  let key: string | undefined;
  for (const k of def.keyEnv) {
    const v = envGet(k);
    if (v) {
      key = v;
      break;
    }
  }
  if (!key) return null;

  let url: string;
  if (def.id === "cloudflare") {
    const account = envGet("CF_ACCOUNT_ID");
    if (!account) return null;
    url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`;
  } else {
    url = `${def.baseUrl}/chat/completions`;
  }
  return { def, key, url };
}

function configuredProviderIds(): ProviderId[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => providerHandle(PROVIDERS[id]) !== null);
}

interface Candidate {
  handle: ProviderHandle;
  model: string;
  routeIndex: number;
}

/**
 * Build the ordered candidate list for a task, honouring:
 *  - the privacy tier (private ⇒ noTrain providers only)
 *  - the route chain for the task (plus LLM_ROUTES_JSON overrides)
 *  - explicit provider allow-list / forced model
 *  - cooldowns (cooled providers move to the back, they are never dropped
 *    outright — otherwise a single stale cooldown would kill the app)
 */
function buildCandidates(task: string, opts: LlmCallOptions, sensitivity: Sensitivity): Candidate[] {
  const disabled = (envGet("LLM_DISABLED_PROVIDERS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowed = opts.providers?.map((p) => p.toLowerCase());

  const chain: Route[] = routesOverride(envGet("LLM_ROUTES_JSON"), task) ?? ROUTES[task] ?? ROUTES.chat;

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const push = (providerId: ProviderId, model: string, routeIndex: number) => {
    const def = PROVIDERS[providerId];
    if (!def) return;
    if (disabled.includes(providerId)) return;
    if (allowed && !allowed.includes(providerId)) return;
    if (sensitivity === "private" && !def.noTrain) return;
    const handle = providerHandle(def);
    if (!handle) return;
    const key = `${providerId}:${model}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ handle, model, routeIndex });
  };

  if (opts.model) {
    const idx = opts.model.indexOf(":");
    const maybeProvider = idx > 0 ? (opts.model.slice(0, idx) as ProviderId) : undefined;
    if (maybeProvider && PROVIDERS[maybeProvider]) {
      push(maybeProvider, opts.model.slice(idx + 1), -1);
    } else {
      for (const [id, def] of Object.entries(PROVIDERS) as [ProviderId, ProviderDef][]) {
        if (envGet(def.keyEnv[0])) push(id, opts.model, -1);
      }
    }
  }

  chain.forEach((route, i) => push(route.provider, route.model, i));

  // Cooldown ordering (stable): healthy routes keep their order.
  const now = Date.now();
  const healthy = candidates.filter((c) => (cooldowns.get(c.handle.def.id) ?? 0) <= now);
  const cooling = candidates.filter((c) => (cooldowns.get(c.handle.def.id) ?? 0) > now);
  return [...healthy, ...cooling].slice(0, 4);
}

// ── cooldowns ─────────────────────────────────────────────────────────────

const cooldowns = new Map<string, number>(); // providerId -> epoch ms
const persistentCooldowns = new Map<string, number>();
let cooldownsLoadedAt = 0;

async function loadCooldowns(): Promise<void> {
  if (Date.now() - cooldownsLoadedAt < 60_000) return;
  cooldownsLoadedAt = Date.now();
  const sb = await adminClient();
  if (!sb) return;
  try {
    const { data } = await withTimeout<any>(
      sb.from("llm_cooldowns").select("provider,until").limit(50),
      1500,
      "loadCooldowns",
    );
    if (Array.isArray(data)) {
      for (const row of data as { provider: string; until: string }[]) {
        const at = Date.parse(row.until);
        if (Number.isFinite(at)) persistentCooldowns.set(row.provider, at);
      }
    }
  } catch {
    /* cooldowns are an optimisation, never a dependency */
  }
}

function cooldownRemaining(provider: string): number {
  const until = Math.max(cooldowns.get(provider) ?? 0, persistentCooldowns.get(provider) ?? 0);
  return Math.max(0, until - Date.now());
}

function cooldownSecondsFor(status: number, attempt: number): number {
  if (status === 429) return Math.min(60 * attempt, 300);
  if (status === 402) return 3600;
  if (status === 401) return 3600;
  if (status === 404) return 3600;
  if (status === 504) return 60;
  if (status >= 500) return 120;
  return 0;
}

function setCooldown(provider: string, seconds: number, reason: string): void {
  if (seconds <= 0) return;
  const until = Date.now() + seconds * 1000;
  cooldowns.set(provider, until);
  persistentCooldowns.set(provider, until);
  void (async () => {
    const sb = await adminClient();
    if (!sb) return;
    try {
      await sb.rpc("llm_cooldown_set", {
        p_provider: provider,
        p_until: new Date(until).toISOString(),
        p_reason: reason.slice(0, 120),
      });
    } catch {
      /* ignore */
    }
  })();
}

// ── cache (low sensitivity only) ──────────────────────────────────────────

const inflight = new Map<string, Promise<LlmResult>>();

async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return `fnv${(h >>> 0).toString(16)}`;
  }
}

async function cacheGet(key: string): Promise<LlmResult | null> {
  const sb = await adminClient();
  if (!sb) return null;
  try {
    const { data } = await withTimeout<any>(
      sb.from("llm_cache").select("value,provider,model").eq("key", key).gt("expires_at", new Date().toISOString()).maybeSingle(),
      1500,
      "cacheGet",
    );
    if (!data?.value) return null;
    return {
      text: String(data.value),
      provider: String(data.provider ?? "cache"),
      model: String(data.model ?? "cache"),
      cached: true,
      degraded: false,
      attempts: 0,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
    };
  } catch {
    return null;
  }
}

function cachePut(key: string, result: LlmResult, ttlSeconds: number): void {
  void (async () => {
    const sb = await adminClient();
    if (!sb) return;
    try {
      await sb.from("llm_cache").upsert({
        key,
        value: result.text,
        provider: result.provider,
        model: result.model,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      });
    } catch {
      /* ignore */
    }
  })();
}

// ── usage accounting + daily budget ───────────────────────────────────────

function recordUsage(row: {
  provider: string;
  model: string;
  task: string;
  ok: boolean;
  tokensIn: number;
  tokensOut: number;
}): void {
  void (async () => {
    const sb = await adminClient();
    if (!sb) return;
    try {
      await sb.rpc("llm_usage_bump", {
        p_day: new Date().toISOString().slice(0, 10),
        p_provider: row.provider,
        p_model: row.model,
        p_task: row.task,
        p_ok: row.ok,
        p_tokens_in: Math.max(0, Math.round(row.tokensIn)),
        p_tokens_out: Math.max(0, Math.round(row.tokensOut)),
      });
    } catch {
      /* ignore */
    }
  })();
}

let dailyBudgetCache: { at: number; tokens: number } | null = null;

async function tokensUsedToday(): Promise<number> {
  const budget = Number(envGet("LLM_DAILY_TOKEN_BUDGET") ?? "60000");
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  if (dailyBudgetCache && Date.now() - dailyBudgetCache.at < 60_000) return dailyBudgetCache.tokens;
  let tokens = 0;
  const sb = await adminClient();
  if (sb) {
    try {
      const { data } = await withTimeout<any>(
        sb.from("llm_usage").select("tokens_in,tokens_out").eq("day", new Date().toISOString().slice(0, 10)).limit(200),
        1500,
        "tokensUsedToday",
      );
      if (Array.isArray(data)) {
        tokens = (data as { tokens_in: number; tokens_out: number }[]).reduce(
          (n, r) => n + Number(r.tokens_in ?? 0) + Number(r.tokens_out ?? 0),
          0,
        );
      }
    } catch {
      tokens = 0;
    }
  }
  dailyBudgetCache = { at: Date.now(), tokens };
  return tokens;
}

function bumpBudgetLocal(tokensIn: number, tokensOut: number): void {
  if (dailyBudgetCache) dailyBudgetCache.tokens += tokensIn + tokensOut;
}

// ── the call ──────────────────────────────────────────────────────────────

async function callProvider(
  candidate: Candidate,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  json: boolean,
  timeoutMs: number,
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const { handle, model } = candidate;
  const body: Record<string, unknown> = { model, messages, temperature, max_tokens: maxTokens, stream: false };
  if (json) body.response_format = { type: "json_object" };

  const doFetch = async (withJsonMode: boolean): Promise<Response> => {
    const payload = { ...body };
    if (!withJsonMode) delete payload.response_format;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(handle.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${handle.key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsofyou.app",
          "X-Title": "NewsOfYou",
        },
        body: JSON.stringify(payload),
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res: Response;
  try {
    res = await doFetch(json);
    // Some free models reject response_format — retry once without it.
    if (res.status === 400 && json) res = await doFetch(false);
  } catch (e) {
    throw new AiError(504, `${handle.def.label}: ${e instanceof Error ? e.message : "network error"}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 140);
    } catch {
      /* ignore */
    }
    throw new AiError(res.status, `${handle.def.label}/${model} ${res.status} ${detail}`.trim());
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new AiError(502, `${handle.def.label}/${model}: invalid JSON`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new AiError(502, `${handle.def.label}/${model}: empty response`);
  }

  return {
    text,
    tokensIn: Number(data?.usage?.prompt_tokens ?? 0),
    tokensOut: Number(data?.usage?.completion_tokens ?? 0),
  };
}

/**
 * Test/maintenance helper: forget in-process cooldowns, cache state and the
 * budget memo. The persisted copies in `llm_cooldowns` are untouched.
 */
function resetRouterState(): void {
  cooldowns.clear();
  persistentCooldowns.clear();
  inflight.clear();
  dailyBudgetCache = null;
  _adminTried = false;
  _admin = null;
  cooldownsLoadedAt = 0;
}

/**
 * Single entry point for every AI call in the app.
 * Callers MUST handle `AiUnavailable` with a non-AI fallback.
 */
async function callLLM(opts: LlmCallOptions): Promise<LlmResult> {
  const started = Date.now();
  const task = opts.task ?? "chat";
  const profile = profileFor(task);
  const sensitivity: Sensitivity = opts.sensitivity ?? (opts.personal ? "private" : profile.sensitivity);
  const json = opts.json ?? profile.json;
  const temperature = opts.temperature ?? profile.temperature;

  // Budget: degrade (soft) or refuse (strict) once today's free quota is spent.
  const budget = Number(envGet("LLM_DAILY_TOKEN_BUDGET") ?? "60000");
  const usedToday = await tokensUsedToday();
  const spent = Number.isFinite(budget) && budget > 0 && usedToday >= budget;
  if (spent && (opts.budgetMode ?? "soft") === "strict") {
    throw new AiError(429, "Daily AI limit reached — the app will use its saved replies.");
  }
  const degraded = spent;
  const timeoutMs = opts.timeoutMs ?? profile.timeoutMs;
  const maxTokens = Math.max(
    16,
    Math.min(opts.maxTokens ?? profile.maxTokens, degraded ? Math.min(80, profile.maxTokens) : profile.maxTokens),
  );

  // Cache: low sensitivity only (never cache anything personal).
  const ttl = sensitivity === "low" ? opts.ttlSeconds ?? profile.cacheTtlSeconds : 0;
  const cacheable = ttl > 0;

  // Context minimisation before anything leaves the process.
  const shouldRedact = opts.redactPii ?? sensitivity === "private";
  const prepared = (opts.messages ?? []).map((m) => ({
    role: m.role,
    content: shouldRedact ? redact(m.content) : m.content,
  }));
  const trimmed = trimMessages(prepared, opts.trimTo ?? profile.maxInputTokens);

  const cacheKey = cacheable
    ? await sha256(
        ["v2", task, String(json), String(temperature), String(maxTokens), opts.cacheKey ?? "", trimmed.messages.map((m) => `${m.role}:${m.content}`).join("\n")].join("|"),
      )
    : "";

  if (cacheable) {
    const hit = await cacheGet(cacheKey);
    if (hit) return { ...hit, tokensIn: trimmed.tokens, tokensOut: estimateTokens(hit.text), latencyMs: Date.now() - started };
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
  }

  const run = async (): Promise<LlmResult> => {
    await loadCooldowns();
    const candidates = buildCandidates(task, opts, sensitivity);
    if (candidates.length === 0) {
      const needed = sensitivity === "private" ? privateProviderIds().map((id) => PROVIDERS[id].keyEnv[0]) : Object.values(PROVIDERS).flatMap((p) => p.keyEnv);
      throw new AiError(
        500,
        `No ${sensitivity} LLM provider configured. Set one of: ${needed.join(", ")}.`,
      );
    }

    let attempts = 0;
    let lastError: unknown = null;

    for (const candidate of candidates) {
      attempts++;
      try {
        const out = await callProvider(candidate, trimmed.messages, temperature, maxTokens, json, timeoutMs);
        const result: LlmResult = {
          text: out.text,
          provider: candidate.handle.def.id,
          model: candidate.model,
          cached: false,
          degraded,
          attempts,
          tokensIn: out.tokensIn || trimmed.tokens,
          tokensOut: out.tokensOut || estimateTokens(out.text),
          latencyMs: Date.now() - started,
        };
        if (cacheable && cacheKey) cachePut(cacheKey, result, ttl);
        recordUsage({
          provider: result.provider,
          model: result.model,
          task,
          ok: true,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        });
        bumpBudgetLocal(result.tokensIn, result.tokensOut);
        return result;
      } catch (e) {
        lastError = e;
        const status = e instanceof AiError ? e.status : 500;
        const cooldown = cooldownSecondsFor(status, attempts);
        if (cooldown > 0) setCooldown(candidate.handle.def.id, cooldown, `${status} on ${candidate.model}`);
        recordUsage({ provider: candidate.handle.def.id, model: candidate.model, task, ok: false, tokensIn: 0, tokensOut: 0 });
        continue;
      }
    }

    throw new AiUnavailable(
      lastError instanceof Error ? lastError.message : "All AI providers failed",
      attempts,
    );
  };

  if (!cacheable) return run();
  const promise = run().finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, promise);
  return promise;
}

/** Convenience: text-only result. */
async function callLLMText(opts: LlmCallOptions): Promise<string> {
  return (await callLLM(opts)).text;
}

/**
 * Back-compat shim: the signature every existing function already uses
 * (`callOpenRouter(messages, {...})`). New code should call callLLM() and use
 * the richer result, but every option is available here too.
 */
type CallOptions = Omit<LlmCallOptions, "messages">;

async function callOpenRouter(messages: ChatMessage[], opts: CallOptions = {}): Promise<string> {
  const result = await callLLM({ ...opts, messages });
  return result.text;
}

// ── auth helpers ──────────────────────────────────────────────────────────

async function requireUser(req: Request): Promise<{ userId: string; supabase: any }> {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabaseUrl = envGet("SUPABASE_URL")!;
  const serviceKey = envGet("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = envGet("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) throw new AiError(401, "Unauthorized");

  const admin = createClient(supabaseUrl, serviceKey);
  return { userId: user.id, supabase: admin };
}

/** Auth is required unless AI_REQUIRE_AUTH=false. Returns null when anonymous. */
async function optionalUser(req: Request): Promise<{ userId: string | null; supabase: any | null }> {
  try {
    const { userId, supabase } = await requireUser(req);
    return { userId, supabase };
  } catch (e) {
    if ((envGet("AI_REQUIRE_AUTH") ?? "true").toLowerCase() === "false") {
      return { userId: null, supabase: await adminClient() };
    }
    throw e;
  }
}

async function requirePartner(req: Request): Promise<{ userId: string; supabase: any }> {
  const { userId, supabase } = await requireUser(req);
  const { data: profile } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!profile || !["partner", "admin"].includes(profile.role)) {
    throw new AiError(403, "Not a chat participant");
  }
  return { userId, supabase };
}

/** The single twin owner (build-plan Phase 4/7: only he edits the twin). */
async function requireOwner(req: Request): Promise<{ userId: string; supabase: any; config: any }> {
  const { userId, supabase } = await requirePartner(req);
  const { data: config } = await supabase.from("twin_config").select("*").eq("id", 1).maybeSingle();
  if (!config) throw new AiError(409, "Twin is not configured yet.");
  if (config.owner_user_id !== userId) throw new AiError(403, "Only the twin's owner can do that.");
  return { userId, supabase, config };
}
// ── END GENERATED BLOCK ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, supabase, config } = await requireOwner(req);
    // (body is accepted and ignored today; kept so the client can POST {}.)
    await req.json().catch(() => ({}));

    // 1. His own messages — the raw material for the measurements.
    const { data: ownerMessages, error: msgErr } = await supabase
      .from("messages")
      .select("content, created_at")
      .eq("user_id", config.owner_user_id)
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(3000);
    if (msgErr) throw new AiError(500, msgErr.message);

    const stats = computeStyleStats(
      (ownerMessages ?? []) as { content: string; created_at: string }[],
      [...(config.partner_nicknames ?? []), config.partner_name],
    );

    if (stats.total_messages < 30) {
      throw new AiError(
        409,
        `Only ${stats.total_messages} of his messages found — the style card needs at least ~30 to be useful.`,
      );
    }

    // 2. Diverse exemplar pairs, round-robin across tones.
    const { data: pairRows, error: pairErr } = await supabase
      .from("reply_pairs")
      .select("partner_text, owner_reply, tone, day")
      .not("embedding", "is", null)
      .order("day", { ascending: false })
      .limit(400);
    if (pairErr) throw new AiError(500, pairErr.message);

    const byTone = new Map<string, { partner_text: string; owner_reply: string; tone: string }[]>();
    for (const row of (pairRows ?? []) as { partner_text: string; owner_reply: string; tone: string | null }[]) {
      const tone = row.tone ?? "other";
      if (!byTone.has(tone)) byTone.set(tone, []);
      const bucket = byTone.get(tone)!;
      if (bucket.length < 12) bucket.push({ partner_text: row.partner_text, owner_reply: row.owner_reply, tone });
    }
    const exemplars: { partner_text: string; owner_reply: string; tone: string }[] = [];
    for (let i = 0; i < 12 && exemplars.length < 60; i++) {
      for (const bucket of byTone.values()) {
        if (bucket[i] && exemplars.length < 60) exemplars.push(bucket[i]);
      }
    }

    // 3. One private LLM call → the card.
    const { system, user } = buildStylePrompt(stats, exemplars, {
      ownerName: config.owner_name,
      partnerName: config.partner_name,
    });

    const result = await callLLM({
      task: "summary",
      sensitivity: "private",
      tag: "build-style-card",
      userId,
      temperature: 0.4,
      maxTokens: 700,
      trimTo: 6000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const card = result.text.trim();
    if (card.length < 80) throw new AiError(502, "The style card came back too short — try again.");

    // 4. Store it (owner can edit this later in Settings).
    const { error: upErr } = await supabase.from("twin_style_card").upsert({
      id: 1,
      card,
      stats: { ...stats, exemplar_count: exemplars.length },
      updated_at: new Date().toISOString(),
    });
    if (upErr) throw new AiError(500, upErr.message);

    return jsonResponse({
      card,
      stats,
      exemplars: exemplars.length,
      model: `${result.provider}/${result.model}`,
      degraded: result.degraded,
    });
  } catch (e) {
    return errorResponse(e);
  }
});
