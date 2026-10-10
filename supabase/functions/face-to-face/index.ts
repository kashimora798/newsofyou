// face-to-face — the hard-conversation room (build-plan Phase 8).
//
//   POST { action: "open",   topic }              → a new room (0 calls)
//   POST { action: "state",  session_id? }        → everything the screen needs (0)
//   POST { action: "join",   session_id }         → 0
//   POST { action: "agree",  session_id }         → 0
//   POST { action: "pause",  session_id, paused } → 0
//   POST { action: "soften", session_id, text }   → 1 `face_to_face` call, nothing stored
//   POST { action: "send",   session_id, text, softened? }  → 0 calls
//   POST { action: "close",  session_id }         → 1 `summary` call (free fallback)
//
// The two rules this function enforces, in code:
//   * a turn is only written when it is really that person's turn;
//   * the moment a turn carries a self-harm or abuse signal, the room stops and
//     both people are shown real resources — the assistant does not continue.
//
// The raw text of a turn is what is checked for safety, and the raw text is
// what is kept (beside the softened version) — nobody can be misquoted.

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/ftf.ts) ──
// ── BEGIN INLINE: ftf.ts ──
/**
 * ftf.ts — Face to Face, the hard-conversation room (build-plan Phase 8).
 *
 * What this module is for: making it easier to say a difficult thing without
 * hurting the person you are saying it to — and knowing when **not** to keep
 * mediating at all.
 *
 * Three jobs, all pure:
 *   1. `FTF_RULES` — the six ground rules both people agree to before the first
 *      word. Same text for both; the room will not start until they agree.
 *   2. `buildSoftenPrompt()` / `parseSoften()` — rewrite one person's turn so
 *      the *point* survives and the blame does not. The rewrite is a suggestion:
 *      the person reads it, can edit it, and only what they send is stored
 *      (with their original kept beside it, so nobody is ever misquoted).
 *   3. `safetyResources()` / `shouldStop()` — the moment a turn carries a
 *      self-harm or abuse signal, the room stops and real help is shown. The
 *      assistant never tries to "handle" that.
 *
 * Nothing here talks to a network or a clock.
 */

export type FtfStopFlag = "self_harm" | "abuse" | string;

export interface FtfTurn {
  id?: string;
  user_id: string;
  kind: string;
  content: string;
  softened?: boolean;
  flags?: string[];
  created_at?: string;
}

export interface SoftenedTurn {
  /** The rewrite. Never sent automatically. */
  gentler: string;
  /** One line of "what I actually need", for the sender to check. */
  need: string;
  /** One line of "how this may land", for the sender to consider. */
  land: string;
  parsed: boolean;
}

/** The ground rules. Short on purpose — nobody reads a manifesto mid-argument. */
const FTF_RULES = `Six rules for this room, for both of us:
1. One thing at a time. We finish one, then the next.
2. I talk about what I felt and what I need — not about what is wrong with you.
3. No name-calling, no mocking, no "you always / you never".
4. Either of us can say "pause" and we stop, without a penalty.
5. Nothing said here gets used as a weapon later, or forwarded.
6. The AI only helps us say things more clearly. It never takes a side, and it never decides anything for us.`;

/** The prompt for one rewrite. Grounded, never sanitising the complaint away. */
function buildSoftenPrompt(input: {
  draft: string;
  senderName: string;
  partnerName: string;
  topicsSoFar?: string[];
}): { system: string; user: string } {
  const system =
    `You help ${input.senderName} say something difficult to ${input.partnerName} without hurting them. ` +
    `Rewrite their message so that:\n` +
    `- every concrete fact and the actual complaint stay — never soften the problem away or turn it into "never mind";\n` +
    `- blame goes: no "you always", "you never", "you made me", no mockery, no threats, no sarcasm;\n` +
    `- it is written in first person about their own feelings and needs ("I felt… when…; what I need is…");\n` +
    `- it stays their language (English / Hindi / Hinglish) and about as long as what they wrote;\n` +
    `- nothing new is added: no facts, no apologies they did not offer, no promises.\n` +
    `Reply with JSON only: {"gentler": "...", "need": "one short line: what they actually need", "land": "one short line: how it may land on ${input.partnerName}"}`;

  const earlier = (input.topicsSoFar ?? []).filter(Boolean).slice(-6);
  const user = earlier.length
    ? `Already said in this room:\n${earlier.map((t) => `- ${t}`).join("\n")}\n\nNew message to rewrite:\n${input.draft}`
    : `Message to rewrite:\n${input.draft}`;

  return { system, user };
}

/** Some models wrap JSON in prose — find the object. Renamed to stay unique. */
function parseFtfJson(raw: string): Record<string, unknown> | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const attempt = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = attempt(text);
  if (direct) return direct;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return attempt(text.slice(start, end + 1));
}

const tidy = (v: unknown, max: number): string =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Whatever came back, only a usable rewrite is kept. */
function parseSoften(raw: string, fallbackDraft: string): SoftenedTurn {
  const obj = parseFtfJson(raw);
  const gentler = tidy(obj?.gentler ?? obj?.reply ?? obj?.text, 900);

  if (!obj || gentler.length < 4) {
    return { gentler: fallbackDraft, need: "", land: "", parsed: false };
  }

  return {
    gentler,
    need: tidy(obj?.need ?? obj?.what_i_need, 160),
    land: tidy(obj?.land ?? obj?.how_it_may_land, 160),
    parsed: true,
  };
}

/**
 * The moment the room stops. Deliberately broad on purpose: a missed flag is a
 * person left alone with something terrible; a false positive only costs one
 * conversation being interrupted with an offer of help.
 */
const STOP_PATTERNS: { flag: FtfStopFlag; patterns: RegExp[] }[] = [
  {
    flag: "self_harm",
    patterns: [
      /\b(?:kill|hurt|cut|harm)(?:ing)? myself\b/i,
      /\b(?:want|wanna|going) to die\b/i,
      /\bsuicid(?:e|al)\b/i,
      /\bend (?:it all|my life|everything)\b/i,
      /\bno (?:reason|point) (?:to|in) liv(?:e|ing)\b/i,
      /\bjaan den[ae]|jaan de dung[ai]|aatmhatya|khudkhushi|khatam kar (?:dunga|dungi) (?:sab|apna)\b/i,
      /\bmar (?:jaunga|jaungi|jaana|jana|jaaun|jaun)\b/i,
      /\bmarna chah(?:ta|ti) (?:hoon|hun)\b/i,
      /\bjeena nahi chaht(?:a|i)\b/i,
    ],
  },
  {
    flag: "abuse",
    patterns: [
      /\b(?:he|she|they|partner|husband|wife|boyfriend|girlfriend|papa|dad|father|uncle|bhai) (?:hits?|beat|beats|hit|slapped|choked|threatened|raped|touched) me\b/i,
      /\bi(?:'m| am) (?:scared|afraid) (?:of|for) (?:him|her|them|my life|my safety)\b/i,
      /\b(?:mar|maar) ?(?:deta|deti|diya|di)\b/i,
      /\b(?:force|forced|forcing) (?:me|kar)/i,
      /\b(?:ghar|ghar mein) (?:nahi|na) (?:jaana|jaana) chahti\b/i,
    ],
  },
];

/** Which flags a piece of text carries (if any). */
function stopFlags(text: string): FtfStopFlag[] {
  const t = String(text ?? "");
  const flags: FtfStopFlag[] = [];
  for (const { flag, patterns } of STOP_PATTERNS) {
    if (patterns.some((p) => p.test(t))) flags.push(flag);
  }
  return flags;
}

/** Convenience: does this stop the room? */
function shouldStop(text: string): { stop: boolean; flags: FtfStopFlag[] } {
  const flags = stopFlags(text);
  return { stop: flags.length > 0, flags };
}

/**
 * What both of them see when a room stops. Real Indian helplines, in the order
 * someone would actually use them. The AI steps out of the way entirely.
 */
function safetyResources(flags: FtfStopFlag[] = []): string {
  const head =
    flags.includes("abuse")
      ? "I'm going to stop helping here, because what you just wrote is not something a chat should carry."
      : "I'm going to stop helping here, because you just wrote something about not being safe, and that matters much more than anything I was doing.";

  return [
    head,
    "",
    "Please talk to a real person today — one of these, or anyone you trust:",
    "• Tele-MANAS (India, 24×7): 14416 — free, and they speak Hindi and English",
    "• AASRA (24×7): 98204 66726",
    "• KIRAN mental-health helpline (24×7): 1800-599-0019",
    "• iCall (Mon–Sat, 10am–8pm): 91529 87821",
    "• If someone is hurting you: Women's Helpline 181 · Police 112 · Childline 1098",
    "",
    "If you are in immediate danger, call 112 now.",
    "",
    "This room is paused, not closed. Anything you two want to say to each other can still be said — but not through me.",
  ].join("\n");
}

/** Whose turn is it now? Kept here so the UI and the SQL never disagree. */
function nextTurn(current: string | null, a: string, b: string | null): string | null {
  if (!b) return current ?? a;
  if (!current) return a;
  return current === a ? b : a;
}

/** Has the room gone on long enough to deserve a closing note? */
function shouldOfferClosing(session: { turn_count?: number; max_turns?: number; stage?: string }): boolean {
  if (session.stage === "closing") return true;
  const count = Number(session.turn_count ?? 0);
  const max = Number(session.max_turns ?? 24);
  return count >= max;
}

/**
 * The closing note: what each of them said they needed, and one next step.
 * The prompt asks for JSON so the room can render it as three short blocks.
 */
function buildClosingPrompt(input: {
  ownerName: string;
  partnerName: string;
  topic: string;
  turns: FtfTurn[];
}): { system: string; user: string } {
  const system =
    `Two people just finished a hard conversation about "${input.topic}". ` +
    `Write a short closing note that helps them remember it kindly. ` +
    `Reply with JSON only: {"note": "3-5 short sentences, plain and warm, no advice, no therapy-speak", ` +
    `"needs_${input.ownerName.toLowerCase().replace(/[^a-z]/g, "") || "a"}": "one line — what he asked for", ` +
    `"needs_${input.partnerName.toLowerCase().replace(/[^a-z]/g, "") || "b"}": "one line — what she asked for", ` +
    `"next_step": "one concrete, small thing they agreed to try"}. ` +
    `Use only what is in their words. If they did not agree anything, say so gently in next_step rather than inventing it.`;

  const transcript = input.turns
    .filter((t) => t.kind === "message" && t.content.trim())
    .map((t) => `${t.user_id === "owner" ? input.ownerName : input.partnerName}: ${t.content}`)
    .join("\n");

  return { system, user: `Their conversation:\n${transcript.slice(0, 5000)}` };
}

/** Whatever the model returned, reduced to what the note card renders. */
function parseClosing(raw: string, fallback: { note: string }): {
  note: string;
  aNeed: string;
  bNeed: string;
  nextStep: string;
  parsed: boolean;
} {
  const obj = parseFtfJson(raw);
  const note = tidy(obj?.note, 1200);
  const values = Object.values(obj ?? {});
  const needs = values.filter((v) => typeof v === "string").slice(0, 4) as string[];

  return {
    note: note.length >= 10 ? note : fallback.note,
    aNeed: tidy(obj?.needs_a ?? needs[0], 200),
    bNeed: tidy(obj?.needs_b ?? needs[1], 200),
    nextStep: tidy(obj?.next_step ?? obj?.nextStep, 200),
    parsed: Boolean(obj && note.length >= 10),
  };
}

/** A free closing note — used when the model is out of quota or fails. */
function heuristicClosing(turns: FtfTurn[], names: { a: string; b: string }): string {
  const spoken = turns.filter((t) => t.kind === "message" && t.content.trim());
  const a = spoken.filter((t) => t.user_id === "owner").length;
  const b = spoken.filter((t) => t.user_id === "partner").length;
  if (spoken.length === 0) {
    return "The room is closed — nothing was said this time, and that is allowed too. The door stays open.";
  }
  return (
    `You both came into this room instead of letting it sit: ${names.a} said ${a} thing${a === 1 ? "" : "s"}, ` +
    `${names.b} said ${b}. Nobody has to have won it. ` +
    `If something is still open, the next move is a small one — one sentence, one hour, no history.`
  );
}

export type { FtfStopFlag as FtfStopFlagType, FtfTurn as FtfTurnRow };
export {
  buildClosingPrompt,
  buildSoftenPrompt,
  FTF_RULES,
  heuristicClosing,
  nextTurn,
  parseClosing,
  parseFtfJson,
  parseSoften,
  safetyResources,
  shouldOfferClosing,
  shouldStop,
  stopFlags,
};
// ── END INLINE: ftf.ts ──
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
    const { userId, supabase } = await requirePartner(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "state");

    // Every room RPC checks `auth.uid()`, so those calls run as the person.
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = async () => {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      return createClient(envGet("SUPABASE_URL")!, envGet("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    };
    const me = await asUser();

    const { data: cfg } = await supabase.from("twin_config").select("*").eq("id", 1).maybeSingle();
    const ownerName: string = cfg?.owner_name ?? "him";
    const partnerName: string = cfg?.partner_name ?? "her";
    const names = { ownerName, partnerName };
    const isOwner = userId === (cfg?.owner_user_id ?? "");

    // ── free actions ──────────────────────────────────────────────────────
    if (action === "open") {
      const { data, error } = await me.rpc("ftf_open", { p_topic: String(body?.topic ?? "").slice(0, 200) });
      if (error) throw new AiError(400, error.message);
      return jsonResponse({ ok: true, session: data });
    }

    if (action === "join") {
      const { data, error } = await me.rpc("ftf_join", { p_session: body?.session_id });
      if (error) throw new AiError(400, error.message);
      return jsonResponse({ ok: true, session: data });
    }

    if (action === "agree") {
      const { data, error } = await me.rpc("ftf_agree", { p_session: body?.session_id });
      if (error) throw new AiError(400, error.message);
      return jsonResponse({ ok: true, session: data, both_agreed: (data as { both_agreed?: boolean })?.both_agreed });
    }

    if (action === "pause") {
      const { data, error } = await me.rpc("ftf_pause", {
        p_session: body?.session_id,
        p_paused: body?.paused !== false,
      });
      if (error) throw new AiError(400, error.message);
      return jsonResponse({ ok: true, session: data });
    }

    if (action === "state") {
      const { data, error } = await me.rpc("ftf_state", { p_session: body?.session_id ?? null });
      if (error) throw new AiError(400, error.message);
      return jsonResponse({ ok: true, ...(data as Record<string, unknown>) });
    }

    // ── the one paid action that is never stored ──────────────────────────
    if (action === "soften") {
      const draft = String(body?.text ?? "").trim().slice(0, 900);
      if (!draft) throw new AiError(400, "nothing to rewrite");

      // Safety first — before the model, not after. A turn that trips a stop
      // flag never gets "improved"; the room stops.
      const stop = shouldStop(draft);
      if (stop.stop) {
        return jsonResponse({ ok: false, stop: true, flags: stop.flags, resources: safetyResources(stop.flags) });
      }

      const { data: state } = await me.rpc("ftf_state", { p_session: body?.session_id });
      const turns = ((state as { turns?: FtfTurn[] })?.turns ?? []).filter((t) => t.kind === "message").slice(-6);

      const prompt = buildSoftenPrompt({
        draft,
        senderName: isOwner ? ownerName : partnerName,
        partnerName: isOwner ? partnerName : ownerName,
        topicsSoFar: turns.map((t) => `${t.user_id === cfg?.owner_user_id ? ownerName : partnerName}: ${t.content}`),
      });

      try {
        const result = await callLLM({
          task: "face_to_face",
          sensitivity: "private",
          tag: "ftf-soften",
          userId,
          json: true,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });

        // The rewrite gets the same safety screen as the draft: if the model
        // returned something that trips a flag, it is not offered at all.
        const checked = shouldStop(result.text);
        const softened = parseSoften(result.text, draft);
        const safe = !checked.stop && !shouldStop(softened.gentler).stop;

        return jsonResponse({
          ok: true,
          ...softened,
          safe,
          model: `${result.provider}/${result.model}`,
          tokens: (result.tokensIn ?? 0) + (result.tokensOut ?? 0),
        });
      } catch (e) {
        // No rewrite available? Their own words are always allowed.
        return jsonResponse({ ok: true, gentler: draft, need: "", land: "", parsed: false, unavailable: true, error: e instanceof Error ? e.message : "unavailable" });
      }
    }

    // ── sending a turn ────────────────────────────────────────────────────
    if (action === "send") {
      const raw = String(body?.text ?? "").trim().slice(0, 3000);
      if (!raw) throw new AiError(400, "nothing to say");

      const stop = shouldStop(raw);
      const softenedText = typeof body?.softened === "string" ? String(body.softened).trim().slice(0, 3000) : "";
      const useSoftened = body?.use_softened === true && softenedText.length > 0;
      const content = useSoftened ? softenedText : raw;

      const { data, error } = await me.rpc("ftf_add_turn", {
        p_session: body?.session_id,
        p_content: content,
        p_original: useSoftened ? raw : null,
        p_softened: useSoftened,
        p_flags: stop.flags,
        p_kind: "message",
      });
      if (error) throw new AiError(400, error.message);

      const stopped = Boolean((data as { stopped?: boolean })?.stopped);

      // The room stopped: both of them get the resources as a system turn, and
      // the assistant says nothing else.
      if (stopped) {
        await supabase.from("ftf_turns").insert({
          session_id: body?.session_id,
          user_id: userId,
          kind: "resources",
          content: safetyResources(stop.flags),
          flags: stop.flags,
        });
      }

      return jsonResponse({ ok: true, stopped, flags: stop.flags, ...(data as Record<string, unknown>) });
    }

    // ── closing the room ──────────────────────────────────────────────────
    if (action === "close") {
      const { data: state } = await me.rpc("ftf_state", { p_session: body?.session_id });
      const session = (state as { session?: Record<string, unknown> })?.session ?? {};
      const turns = ((state as { turns?: FtfTurn[] })?.turns ?? []).filter((t) => t.kind === "message");

      // A closing note only makes sense once something was said; and if the
      // room stopped for safety, there is no note — the resources stand.
      if (turns.length === 0 || (session as { status?: string }).status === "stopped") {
        const { data, error } = await me.rpc("ftf_close", { p_session: body?.session_id, p_note: null });
        if (error) throw new AiError(400, error.message);
        return jsonResponse({ ok: true, note: null, session: data });
      }

      const prompt = buildClosingPrompt({
        ownerName,
        partnerName,
        topic: String((session as { topic?: string }).topic ?? "something"),
        turns: turns.map((t) => ({
          ...t,
          user_id: t.user_id === cfg?.owner_user_id ? "owner" : "partner",
        })),
      });

      let note = heuristicClosing(turns.map((t) => ({ ...t, user_id: t.user_id === cfg?.owner_user_id ? "owner" : "partner" })), {
        a: ownerName,
        b: partnerName,
      });
      let parsed = { aNeed: "", bNeed: "", nextStep: "" };

      try {
        const result = await callLLM({
          task: "summary",
          sensitivity: "private",
          tag: "ftf-close",
          userId,
          json: true,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });
        const closing = parseClosing(result.text, { note });
        note = closing.note;
        parsed = { aNeed: closing.aNeed, bNeed: closing.bNeed, nextStep: closing.nextStep };
      } catch (e) {
        // the free note above stands; the room still closes
        console.error("ftf closing note fell back to heuristics:", e instanceof Error ? e.message : e);
      }

      const { data, error } = await me.rpc("ftf_close", { p_session: body?.session_id, p_note: note });
      if (error) throw new AiError(400, error.message);

      return jsonResponse({ ok: true, note, ...parsed, session: data });
    }

    throw new AiError(400, `Unknown action: ${action}`);
  } catch (e) {
    return errorResponse(e);
  }
});
