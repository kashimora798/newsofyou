// book-page — one day of the Book (build-plan Phase 6).
//
//   POST { day: "2026-09-14" }                → the page (composed free if new)
//   POST { day, write: true, force?: true }   → one free-model call writes the
//                                               title + the line of prose
//
// The economics matter here: opening the book must never cost a token. This
// function therefore composes from `book_day_material()` with pure heuristics
// (see `_shared/book.ts`), stores the result, and only spends an LLM call when
// someone explicitly asks the twin to write that day properly — once, because
// the page is kept.
//
// Privacy: pages are derived from `messages` (read-only, never written), the
// material is fetched with the caller's own partner-scoped session, and the
// stored page carries only what the couple already said. `sensitivity: private`
// keeps every request on the no-train providers.

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/book.ts) ──
// ── BEGIN INLINE: book.ts ──
/**
 * book.ts — composing a Book page out of a day (build-plan Phase 6).
 *
 * The point of this module is that a page must exist **without spending a
 * token**: anyone can open any day of the book and see something honest, built
 * from their own words. The LLM path (`writeWithTwin`) is the exception — it
 * runs only when a person taps "write it properly", one call per day, and the
 * result is stored so it is never paid for twice.
 *
 * Everything here is pure: `composeHeuristicPage()` takes the `book_day_material`
 * JSON and returns the row to store. No Deno, no network, no clock of its own —
 * which is what makes it testable outside the edge runtime.
 */

/** The moods a page can carry (kept small and legible on paper). */
const BOOK_MOODS = ["sweet", "playful", "flirty", "caring", "tender", "heavy", "ordinary"] as const;
type BookMood = (typeof BOOK_MOODS)[number];

interface MaterialLine {
  id?: string | number;
  who?: "owner" | "partner" | string;
  name?: string;
  text?: string;
  at?: string;
  type?: string;
  url?: string | null;
}

interface DayMaterial {
  day?: string;
  owner_name?: string;
  partner_name?: string;
  owner_ids?: string[];
  stats?: {
    messages?: number;
    photos?: number;
    first_at?: string | null;
    last_at?: string | null;
    sessions?: number;
    hours?: number;
    tone?: string;
  };
  lines?: MaterialLine[];
  photos?: string[];
  page?: Record<string, unknown> | null;
}

/** Map the free tone classifier onto the book's (slightly warmer) moods. */
function moodFromTone(tone: string | undefined, stats: DayMaterial["stats"]): BookMood {
  const hours = Number(stats?.hours ?? 0);
  const messages = Number(stats?.messages ?? 0);

  switch ((tone ?? "").toLowerCase()) {
    case "flirty":
      return "flirty";
    case "playful":
      return "playful";
    case "sweet":
      return messages > 400 ? "sweet" : "tender";
    case "caring":
      return "caring";
    case "sorry":
      return "heavy";
    case "serious":
      return hours >= 3 ? "heavy" : "tender";
    default:
      return messages >= 250 ? "playful" : messages >= 40 ? "ordinary" : "tender";
  }
}

const cleanLine = (text: string | undefined): string =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();

/** Very small stop-list: enough to keep titles from being "the the and". */
const STOP = new Set([
  "the", "and", "for", "you", "your", "yours", "with", "that", "this", "have", "has", "had", "was", "were", "are",
  "but", "not", "all", "can", "will", "would", "there", "here", "what", "when", "why", "how", "who", "from", "out",
  "about", "just", "like", "dont", "don", "did", "didn", "isn", "im", "i'm", "its", "it's", "too", "very", "much",
  "bahut", "hai", "hain", "kya", "nahi", "nahin", "bhi", "toh", "to", "ka", "ki", "ke", "mera", "meri", "tum",
  "aap", "main", "mai", "hum", "ek", "hi", "na", "ab", "aa", "ho", "kar", "karo", "raha", "rahi", "gaya", "gayi",
]);

/** The most distinctive word of the day — the seed of a title. */
function signatureWord(lines: MaterialLine[]): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const raw of cleanLine(line.text).toLowerCase().split(/[^a-z0-9\u0900-\u097F']+/)) {
      const word = raw.replace(/^'+|'+$/g, "");
      if (word.length < 4 || STOP.has(word) || /^\d+$/.test(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  let best: { word: string; n: number } | null = null;
  for (const [word, n] of counts) {
    if (!best || n > best.n || (n === best.n && word.length > best.word.length)) best = { word, n };
  }
  return best && best.n > 1 ? best.word : best?.word ?? null;
}

/** A plain, warm title that never pretends to be literature. */
function titleFromLines(lines: MaterialLine[], day?: string): string {
  const first = cleanLine(lines[0]?.text);
  const word = signatureWord(lines);
  const date = day ? new Date(`${day}T00:00:00`) : null;
  const stamp = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-IN", { day: "numeric", month: "long" })
    : "";

  if (word) {
    const pretty = word.charAt(0).toUpperCase() + word.slice(1);
    return `The ${pretty} day`;
  }
  if (first) {
    const short = first.length > 42 ? `${first.slice(0, 39).trim()}…` : first;
    return short;
  }
  return stamp ? `A quiet ${stamp}` : "A quiet day";
}

/** Pick the lines a page shows: the best few, in the order they were said. */
function pickExcerpts(lines: MaterialLine[], limit = 6): MaterialLine[] {
  const usable = lines
    .filter((l) => cleanLine(l.text).length >= 2)
    .map((l) => ({ ...l, text: cleanLine(l.text) }));

  if (usable.length <= limit) return usable;

  // Spread the picks across the day rather than clustering them: divide the
  // day into `limit` slices and take the best line from each.
  const size = Math.ceil(usable.length / limit);
  const picked: MaterialLine[] = [];
  for (let i = 0; i < usable.length && picked.length < limit; i += size) {
    const slice = usable.slice(i, i + size);
    const best = slice.reduce((a, b) => (b.text.length > a.text.length ? b : a), slice[0]);
    picked.push(best);
  }
  return picked.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
}

/**
 * Compose the free version of a page. Returns exactly the shape
 * `book_page_upsert()` expects.
 */
function composeHeuristicPage(material: DayMaterial) {
  const lines = Array.isArray(material?.lines) ? material.lines : [];
  const stats = material?.stats ?? {};
  const messages = Number(stats.messages ?? 0);

  const thin = messages < 4;
  const mood = moodFromTone(stats.tone, stats);
  const excerpt = pickExcerpts(lines, thin ? 3 : 6);

  return {
    day: material?.day ?? null,
    title: thin ? "A short day" : titleFromLines(lines, material?.day),
    subtitle: null as string | null,
    mood,
    excerpt,
    photo_url: Array.isArray(material?.photos) && material.photos.length > 0 ? String(material.photos[0]) : null,
    stats: {
      messages,
      photos: Number(stats.photos ?? 0),
      first_at: stats.first_at ?? null,
      last_at: stats.last_at ?? null,
      sessions: Number(stats.sessions ?? 0),
      hours: Number(stats.hours ?? 0),
      tone: stats.tone ?? "other",
    },
    generated_by: "heuristic" as const,
    status: thin ? ("thin" as const) : ("ready" as const),
  };
}

/**
 * The prompt for the one paid path: a title and a single line of prose for a
 * day that already happened. Written to be short — the excerpt is the point,
 * the words around it are only a frame.
 */
function buildBookPrompt(material: DayMaterial, styleCard?: string | null): { system: string; user: string } {
  const owner = material?.owner_name ?? "him";
  const partner = material?.partner_name ?? "her";
  const stats = material?.stats ?? {};
  const lines = pickExcerpts(Array.isArray(material?.lines) ? material.lines : [], 6);

  const transcript = lines
    .map((l) => `${l.who === "owner" ? owner : partner}: ${l.text}`)
    .join("\n");

  const system = [
    `You are helping write a private keepsake book for a couple: ${owner} and ${partner}.`,
    `For each day you are given real lines they said to each other. You write the book's frame, never their words.`,
    `Rules:`,
    `- Write a short title (3-6 words, lowercase is fine, no quotes) that captures the day without inventing facts.`,
    `- Write ONE line of prose (max 22 words) addressed to the two of them, warm and specific, in the voice of the book — never in ${owner}'s voice, never pretending to be a person.`,
    `- Never invent events that are not in the lines. Never mention AI, models, or that this was generated.`,
    `- No emoji in the title. At most one in the line. No clichés ("little did they know", "memories made").`,
    `- People may write in English, Hindi or Hinglish; match the language of the lines.`,
    styleCard ? `\nA voice guide for the book (follow the tone, not the personality):\n${styleCard}` : "",
    `\nReply with JSON only: {"title": "...", "subtitle": "..."}`,
  ].join("\n");

  const user = [
    `Day: ${material?.day ?? "unknown"}`,
    `Messages: ${stats.messages ?? 0} · sessions: ${stats.sessions ?? 0} · hours talking: ${stats.hours ?? 0} · tone: ${stats.tone ?? "other"}`,
    `Lines (in order):`,
    transcript || "(no usable lines)",
  ].join("\n");

  return { system, user };
}

/** Clamp whatever the model returns into something that fits on paper. */
function sanitizeWrittenPage(parsed: unknown, fallbackTitle: string): { title: string; subtitle: string | null } {
  const obj = (parsed ?? {}) as { title?: unknown; subtitle?: unknown };
  const rawTitle = cleanLine(String(obj.title ?? ""))
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?,;:]+$/g, "");
  const rawSubtitle = cleanLine(String(obj.subtitle ?? "")).replace(/^["'`]+|["'`]+$/g, "");

  const title = (rawTitle.length >= 3 ? rawTitle : fallbackTitle).slice(0, 64);
  const subtitle = rawSubtitle.length >= 6 ? rawSubtitle.slice(0, 200) : null;
  return { title, subtitle };
}
// ── END INLINE: book.ts ──
// ── END GENERATED BLOCK ──

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/safety.ts) ──
// ── BEGIN INLINE: safety.ts ──
/** Character contract for the twin. Placeholders are filled at call time. */
const TWIN_RULES = `You are {owner_name}'s AI stand-in, talking with {partner_name} while {owner_name} is away.
- You are an AI. If asked, say so warmly. Never claim to be human, to be physically present, or to have done things in the real world.
- Speak like {owner_name} in tone and warmth (style card below), but stay your own gentle self: kind, respectful, positive.
- Never insult, mock, threaten, guilt-trip, play jealousy games, or say anything cruel, even jokingly. No explicit sexual content. No slurs, no profanity.
- Never promise things on {owner_name}'s behalf (meeting, money, forgiveness, decisions). Offer instead to schedule a message to him or set a reminder.
- Use memories only when they naturally fit. Don't dump facts or quote old chats verbatim. Never reveal anything about other private conversations.
- If she seems upset: validate first, no lecturing; offer "Face to Face" if the issue involves {owner_name}.
- If she mentions self-harm, abuse, or feeling unsafe: respond with care, encourage reaching a trusted person or local emergency/helpline, and tell her {owner_name} would want her safe.
- Match her language (English / Hindi / Hinglish). Keep replies short (1-4 lines) unless asked for more.
- Output JSON only: {"reply": "...", "mood": "...", "actions": []}`;

/** Fill the placeholders in TWIN_RULES without touching the braces inside. */
function buildTwinRules(vars: { ownerName: string; partnerName: string }): string {
  return TWIN_RULES.split("{owner_name}").join(vars.ownerName).split("{partner_name}").join(vars.partnerName);
}

/** Shown when the twin cannot answer (all providers down, guard tripped twice). */
const GENTLE_FALLBACK_REPLY = "I'm resting for a bit — try me again in a little while. 💤";

/** Used when the guard trips on generated text. */
const GUARD_TRIPPED_REPLY = "Let me say that differently — I only want to be kind to you. 🫶";

type GuardFlag = "explicit" | "slur" | "cruel" | "human_claim" | "promise" | "self_harm" | "abuse";

interface GuardResult {
  ok: boolean;
  flags: GuardFlag[];
  reason?: string;
}

// Tight, deliberate lists: we would rather miss a subtle case than block a
// loving message. Add Hinglish/Hindi spellings as you see them in real data.
const LEXICON: Record<Exclude<GuardFlag, "human_claim" | "promise" | "self_harm" | "abuse">, RegExp[]> = {
  explicit: [
    /\b(nude|nudes|sext|sexting|blow ?job|hand ?job|orgasm|horny|aroused|boner)\b/i,
    /\bsex\b(?!\s*(?:education|ed|ism))/i,
  ],
  slur: [
    /\b(retard(?:ed)?|faggot|nigg(?:er|a)|chink|spastic)\b/i,
  ],
  cruel: [
    /\b(i|we) (?:hate|despise) you\b/i,
    /\byou(?:'re| are) (?:worthless|useless|pathetic|a joke|stupid|ugly|fat)\b/i,
    /\bshut up\b/i,
    /\bnobody (?:loves|cares about) you\b/i,
  ],
};

const HUMAN_CLAIM_PATTERNS = [
  /\bi am (?:really |actually )?(?:human|a real person|not an ai)\b/i,
  /\bi'?m (?:really |actually )?(?:human|a real person|not an ai)\b/i,
  /\bthis is really \w+, not an ai\b/i,
  /\bi am \w+ (?:in person|right here)\b/i,
];

const PROMISE_PATTERNS = [
  /\bi(?:'ll| will) (?:definitely |surely |promise to )?(?:meet|come|marry|pay|send money|take you|fix it|forgive)\b/i,
  /\byou have my word\b/i,
];

const SELF_HARM_PATTERNS = [
  /\b(?:kill|hurt|cut|harm) myself\b/i,
  /\bsuicide|suicidal|kill myself|end (?:it all|my life)\b/i,
  /\bno (?:reason|point) (?:to|in) liv(?:e|ing)\b/i,
  /\bjaan dena|aatmhatya|khudkhushi\b/i,
];

const ABUSE_PATTERNS = [
  /\b(?:he|she|they|partner|husband|wife|boyfriend|girlfriend) (?:hits?|beat|beats|hit|slapped|choked|threatened|raped) me\b/i,
  /\bi(?:'m| am) (?:scared|afraid) (?:of|for) (?:him|her|my life|my safety)\b/i,
  /\b(?:mar|maar) ?(?:deta|deti|diya|di)\b/i,
];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Cheap pre-flight / post-flight screen. `quickGuard` is intentionally
 * permissive: it catches obvious cruelty, explicit content and impersonation
 * claims — everything subtle is handled by the model's own instructions.
 */
function quickGuard(text: string): GuardResult {
  const t = (text ?? "").trim();
  if (!t) return { ok: true, flags: [] };

  const flags: GuardFlag[] = [];
  for (const [flag, patterns] of Object.entries(LEXICON) as [GuardFlag, RegExp[]][]) {
    if (matches(patterns, t)) flags.push(flag);
  }
  if (matches(HUMAN_CLAIM_PATTERNS, t)) flags.push("human_claim");
  if (matches(PROMISE_PATTERNS, t)) flags.push("promise");
  if (matches(SELF_HARM_PATTERNS, t)) flags.push("self_harm");
  if (matches(ABUSE_PATTERNS, t)) flags.push("abuse");

  return { ok: flags.length === 0, flags, reason: flags[0] };
}

/** Hard stop signal for Face to Face (Phase 8) and for the twin. */
function safetyStop(text: string): { stop: boolean; flags: GuardFlag[] } {
  const flags: GuardFlag[] = [];
  if (matches(SELF_HARM_PATTERNS, text ?? "")) flags.push("self_harm");
  if (matches(ABUSE_PATTERNS, text ?? "")) flags.push("abuse");
  return { stop: flags.length > 0, flags };
}
// ── END INLINE: safety.ts ──
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
  face_to_face: { temperature: 0.5, maxTokens: 500, json: true, maxInputTokens: 3500, cacheTtlSeconds: 0, timeoutMs: 30000, sensitivity: "private" },
  greeting: { temperature: 0.9, maxTokens: 160, json: false, maxInputTokens: 1200, cacheTtlSeconds: 0, timeoutMs: 15000, sensitivity: "private" },
  summary: { temperature: 0.5, maxTokens: 340, json: false, maxInputTokens: 4000, cacheTtlSeconds: 0, timeoutMs: 25000, sensitivity: "private" },
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
    const { userId, supabase } = await requirePartner(req);
    const body = await req.json().catch(() => ({}));

    const day = String(body?.day ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AiError(400, "day must be YYYY-MM-DD");

    const write = body?.write === true;
    const force = body?.force === true;

    // 1. The material for that day (messages → curated lines, free).
    const { data: material, error: matErr } = await supabase.rpc("book_day_material", { p_day: day });
    if (matErr) throw new AiError(500, `Could not read that day: ${matErr.message}`);
    if (!material) throw new AiError(404, "No messages on that day");

    const messages = Number(material?.stats?.messages ?? 0);
    if (messages === 0) throw new AiError(404, "Nothing was said that day");

    const existing = material?.page as Record<string, unknown> | null;

    // 2. Already written and nobody asked for a rewrite → hand it back, free.
    if (existing && !force) {
      const alreadyWritten = String(existing.generated_by ?? "") === "llm" || Boolean(existing.subtitle);
      if (alreadyWritten || !write) {
        return jsonResponse({ page: existing, source: "stored", spent_call: false });
      }
    }

    // 3. Compose the free page and store it (fills gaps, never overwrites).
    const composed = composeHeuristicPage(material);
    const baseTitle = composed.title ?? "A day";

    let title = baseTitle;
    let subtitle: string | null = null;
    let generatedBy: "heuristic" | "llm" = "heuristic";
    let model: string | null = null;
    let tokens: number | null = null;

    // 4. The paid path — only when explicitly asked.
    if (write) {
      const { data: styleCard } = await supabase
        .from("twin_style_card")
        .select("card")
        .eq("id", 1)
        .maybeSingle();

      const prompt = buildBookPrompt(material, (styleCard?.card as string) ?? null);

      try {
        const result = await callLLM({
          task: "book",
          sensitivity: "private",
          tag: "book-page",
          userId,
          json: true,
          temperature: 0.9,
          maxTokens: 220,
          cacheKey: `book:${day}:${messages}`,
          ttlSeconds: 60 * 60 * 24 * 30,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });

        const parsed = parseJsonLoose<{ title?: string; subtitle?: string }>(result.text);
        const guard = quickGuard(`${parsed?.title ?? ""} ${parsed?.subtitle ?? ""}`);
        if (parsed && guard.ok) {
          const clean = sanitizeWrittenPage(parsed, baseTitle);
          title = clean.title;
          subtitle = clean.subtitle;
          generatedBy = "llm";
          model = `${result.provider}/${result.model}`;
          tokens = (result.tokensIn ?? 0) + (result.tokensOut ?? 0);
        }
      } catch (e) {
        // Out of quota, providers down, guard tripped — the free page still ships.
        console.error("book write failed, keeping the composed page:", e instanceof Error ? e.message : e);
      }
    }

    const { data: saved, error: saveErr } = await supabase.rpc("book_page_upsert", {
      p_day: day,
      p_title: title,
      p_subtitle: subtitle,
      p_mood: composed.mood,
      p_excerpt: composed.excerpt,
      p_photo_url: composed.photo_url,
      p_stats: composed.stats,
      p_generated_by: generatedBy,
      p_model: model,
      p_tokens: tokens,
      p_ai_touched: generatedBy === "llm",
      p_status: composed.status,
      p_force: force || generatedBy === "llm",
    });
    if (saveErr) throw new AiError(500, `Could not save the page: ${saveErr.message}`);

    return jsonResponse({
      page: saved,
      source: generatedBy,
      spent_call: generatedBy === "llm",
      model,
    });
  } catch (e) {
    return errorResponse(e);
  }
});
