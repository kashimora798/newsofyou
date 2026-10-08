// Phase 2B — fill the greeting bank (run once, then occasionally top up).
//
//   POST { moods?: string[], per_daypart?: number, dry_run?: boolean, replace?: boolean }
//   → { inserted, skipped, guarded, per_mood, model }
//
// Owner-only. ONE LLM call per mood (max 9), each returning `per_daypart`
// greetings for each of the four dayparts, written in the owner's voice using
// the style card. Every line is screened by `quickGuard`, checked for unknown
// placeholders and de-duplicated before it reaches the database.
//
// ~300 greetings for 9 calls. Nothing here is on a user-facing hot path.

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

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/greet.ts) ──
// ── BEGIN INLINE: greet.ts ──
const GREETING_MOODS = [
  "sweet",
  "playful",
  "flirty",
  "missing_you",
  "proud",
  "sleepy",
  "cozy",
  "celebratory",
  "gentle_after_fight",
] as const;

const DAYPARTS = ["morning", "afternoon", "evening", "night"] as const;

type GreetingMood = (typeof GREETING_MOODS)[number];
type Daypart = (typeof DAYPARTS)[number];

/** Local hour -> daypart (5–11 morning, 12–16 afternoon, 17–21 evening, else night). */
function daypartAt(date: Date, timezoneOffsetHours: number): Daypart {
  const local = new Date(date.getTime() + timezoneOffsetHours * 3600 * 1000);
  const hour = local.getUTCHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function isGreetingMood(value: string): value is GreetingMood {
  return (GREETING_MOODS as readonly string[]).includes(value);
}

interface GreetContext {
  daypart: Daypart;
  /** Dominant tone of her last-24h messages ("sweet" | "hurtful" | ... ) */
  herToneToday?: string | null;
  /** Hours since the last greeting was shown (null = first time). */
  hoursSinceLastGreeting?: number | null;
  /** Days since she last opened the app (from user_status.last_seen). */
  daysSinceSeen?: number | null;
  /** Days until the anniversary (negative = just passed). */
  daysToAnniversary?: number | null;
  /** Days until her birthday (negative = just passed). */
  daysToBirthday?: number | null;
  /** The mood shown last time, so we can avoid repeating it. */
  lastMood?: string | null;
}

/**
 * Weighted mood choice. Deliberately transparent — every rule is one line so
 * it can be argued with and tested.
 */
function moodWeights(ctx: GreetContext): Record<GreetingMood, number> {
  const w: Record<GreetingMood, number> = {
    sweet: 3,
    playful: 2,
    flirty: 2,
    missing_you: 1,
    proud: 1,
    sleepy: 1,
    cozy: 1,
    celebratory: 1,
    gentle_after_fight: 0.4,
  };

  switch (ctx.daypart) {
    case "morning":
      w.sweet += 2;
      w.sleepy += 1.5;
      w.playful += 1;
      break;
    case "afternoon":
      w.playful += 2;
      w.proud += 1;
      break;
    case "evening":
      w.cozy += 2;
      w.missing_you += 1.5;
      break;
    case "night":
      w.sleepy += 2;
      w.flirty += 2;
      w.missing_you += 1;
      break;
  }

  const tone = (ctx.herToneToday ?? "").toLowerCase();
  if (tone === "hurtful" || tone === "serious") {
    w.gentle_after_fight += 6;
    w.cozy += 2;
    w.sweet += 1;
    w.flirty = 0;
    w.playful = 0;
  } else if (tone === "sweet") {
    w.sweet += 2;
    w.flirty += 1;
  } else if (tone === "playful") {
    w.playful += 2;
  } else if (tone === "sorry") {
    w.gentle_after_fight += 4;
    w.sweet += 2;
  }

  // Time apart.
  const hours = ctx.hoursSinceLastGreeting;
  if (hours !== null && hours !== undefined) {
    if (hours > 72) w.missing_you += 4;
    else if (hours > 24) w.missing_you += 2;
    else if (hours < 8) w.cozy += 1;
  }
  const away = ctx.daysSinceSeen;
  if (away !== null && away !== undefined && away >= 3) w.missing_you += 3;

  // Dates.
  const ann = ctx.daysToAnniversary;
  if (ann !== null && ann !== undefined && ann >= 0 && ann <= 7) w.celebratory += 5;
  const bday = ctx.daysToBirthday;
  if (bday !== null && bday !== undefined && bday >= 0 && bday <= 7) w.celebratory += 6;

  // Don't repeat the mood we just showed — unless it is the only one left.
  if (ctx.lastMood && isGreetingMood(ctx.lastMood)) {
    w[ctx.lastMood] = 0;
    if (Object.values(w).every((v) => v <= 0)) w[ctx.lastMood] = 1;
  }

  return w;
}

function pickMood(ctx: GreetContext, rand: () => number = Math.random): GreetingMood {
  const weights = moodWeights(ctx);
  const entries = Object.entries(weights).filter(([, v]) => v > 0) as [GreetingMood, number][];
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (total <= 0) return "sweet";

  let roll = rand() * total;
  for (const [mood, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return mood;
  }
  return entries[entries.length - 1][0];
}

interface TemplateVars {
  nickname?: string | null;
  ownerNickname?: string | null;
  ownerName?: string | null;
  partnerName?: string | null;
  daysTogether?: number | null;
  lastMemory?: string | null;
  date?: Date;
  timezoneOffsetHours?: number;
}

/** Fill {placeholders}; unknown placeholders are removed, never left raw. */
function fillTemplate(text: string, vars: TemplateVars): string {
  const date = vars.date ?? new Date();
  const tz = vars.timezoneOffsetHours ?? 5.5;
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(date);
  const map: Record<string, string> = {
    nickname: vars.nickname ?? vars.partnerName ?? "jaan",
    owner_nickname: vars.ownerNickname ?? vars.ownerName ?? "",
    owner_name: vars.ownerName ?? "",
    partner_name: vars.partnerName ?? "",
    days_together: vars.daysTogether !== null && vars.daysTogether !== undefined ? String(vars.daysTogether) : "",
    last_memory: vars.lastMemory ?? "",
    weekday,
    daypart: daypartAt(date, tz),
  };

  let out = text.replace(/\{(\w+)\}/g, (_m, key: string) => map[key] ?? "");
  // Tidy up artefacts from removed placeholders.
  out = out
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .trim();
  return out;
}

/** Placeholders a bank line may use, for validation while seeding. */
const ALLOWED_PLACEHOLDERS = ["nickname", "owner_nickname", "days_together", "last_memory", "weekday"];

function unknownPlaceholders(text: string): string[] {
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((p) => !ALLOWED_PLACEHOLDERS.includes(p)))];
}

/**
 * Choose the least-used line for a mood. The database does the same ordering
 * with `twin_greeting_pick`; this mirror exists so the UI can preview and the
 * behaviour can be unit-tested without a database.
 */
function pickFromBank<T extends { text: string; uses?: number | null; last_used_at?: string | null }>(
  rows: T[],
  opts: { avoidTexts?: string[]; rand?: () => number } = {},
): T | null {
  const avoid = new Set((opts.avoidTexts ?? []).map((t) => t.toLowerCase()));
  const usable = rows.filter((r) => r.text && !avoid.has(r.text.toLowerCase()));
  if (usable.length === 0) return null;

  const rand = opts.rand ?? Math.random;
  return usable
    .slice()
    .sort((a, b) => {
      const uses = (a.uses ?? 0) - (b.uses ?? 0);
      if (uses !== 0) return uses;
      const at = a.last_used_at ? Date.parse(a.last_used_at) : 0;
      const bt = b.last_used_at ? Date.parse(b.last_used_at) : 0;
      if (at !== bt) return at - bt;
      return rand() - 0.5;
    })[0];
}

/** Live greeting budget: at most `perDay` and never twice in one local day. */
function liveAllowed(
  ctx: { liveToday?: number | null; hoursSinceLastGreeting?: number | null },
  perDay = 1,
): boolean {
  if ((ctx.liveToday ?? 0) >= Math.max(perDay, 0)) return false;
  if (perDay <= 0) return false;
  // Don't burn an AI call on a quick page refresh.
  return (ctx.hoursSinceLastGreeting ?? 99) >= 6;
}

/** Static, always-available lines: used when the bank is empty AND AI is down. */
const STATIC_GREETINGS: Record<Daypart, string[]> = {
  morning: ["Good morning, {nickname}. I hope today is gentle with you. ☀️", "Morning, {nickname}. Thinking of you first, like always."],
  afternoon: ["Hey {nickname} — hope your afternoon is going okay. 🫶", "Just checking in, {nickname}. How's the day treating you?"],
  evening: ["Evening, {nickname}. The day's almost done — how are you? 🌆", "Hi {nickname}. Missing you a little extra right now."],
  night: ["Good night, {nickname}. Sleep well — I'll be here tomorrow. 🌙", "It's late, {nickname}. Rest well and dream something lovely."],
};

function staticGreeting(daypart: Daypart, rand: () => number = Math.random): string {
  const lines = STATIC_GREETINGS[daypart] ?? STATIC_GREETINGS.night;
  return lines[Math.floor(rand() * lines.length) % lines.length];
}
// ── END INLINE: greet.ts ──
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
    const body = await req.json().catch(() => ({}));

    const moods: string[] = Array.isArray(body?.moods) && body.moods.length > 0
      ? body.moods.filter((m: unknown) => isGreetingMood(String(m)))
      : [...GREETING_MOODS];
    const perDaypart = Math.min(Math.max(Number(body?.per_daypart ?? 3), 1), 6);
    const dryRun = body?.dry_run === true;
    const replace = body?.replace === true;

    const { data: styleCard } = await supabase
      .from("twin_style_card")
      .select("card")
      .eq("id", 1)
      .maybeSingle();

    if (replace && !dryRun) {
      // Re-seeding should not wipe lines the owner wrote or edited by hand.
      await supabase.from("twin_greeting_bank").delete().eq("source", "seed");
    }

    const perMood: Record<string, number> = {};
    let inserted = 0;
    let skipped = 0;
    let guarded = 0;
    let lastModel = "";

    for (const mood of moods) {
      const result = await callLLM({
        task: "greeting",
        sensitivity: "private",
        tag: "seed-greetings",
        userId,
        json: true,
        temperature: 1.0,
        maxTokens: 900,
        messages: [
          {
            role: "system",
            content:
              `You write greeting lines for a private couples app. The speaker is ${config.owner_name}'s AI stand-in ` +
              `and the reader is ${config.partner_name ?? "his partner"}. ` +
              `Voice: warm, simple, a little playful, never cheesy or formal, no pet-name overload. ` +
              `Never claim to be human, never promise anything on his behalf, no questions that demand an answer. ` +
              `Hinglish is welcome where it feels natural (they are Indian). 0-2 emoji per line. ` +
              `You may use ONLY these placeholders: {nickname}, {days_together}, {last_memory}, {weekday}. ` +
              `Mood for this batch: ${mood}. ` +
              (styleCard?.card ? `\nWrite in his voice, following this style card:\n${styleCard.card}\n` : "") +
              `Return ONLY JSON: {"greetings":[{"daypart":"morning|afternoon|evening|night","text":"..."}]}`,
          },
          {
            role: "user",
            content:
              `Write ${perDaypart} greetings for EACH daypart (morning, afternoon, evening, night) in the "${mood}" mood ` +
              `— ${perDaypart * 4} lines total. Keep each line under 140 characters.`,
          },
        ],
      });

      lastModel = `${result.provider}/${result.model}`;
      const parsed = parseJsonLoose<{ greetings?: { daypart?: string; text?: string }[] }>(result.text);
      const rows = (parsed?.greetings ?? [])
        .map((g) => ({
          mood,
          daypart: DAYPARTS.includes(String(g?.daypart) as never) ? String(g.daypart) : "any",
          text: String(g?.text ?? "").replace(/\s+/g, " ").trim(),
          source: "seed",
          active: true,
        }))
        .filter((r) => r.text.length >= 12 && r.text.length <= 200);

      let moodCount = 0;
      for (const row of rows) {
        const unknown = unknownPlaceholders(row.text);
        const guard = quickGuard(row.text);
        if (unknown.length > 0 || !guard.ok) {
          guarded++;
          continue;
        }
        if (dryRun) {
          moodCount++;
          continue;
        }
        const { error } = await supabase.from("twin_greeting_bank").insert(row);
        if (error) {
          // unique violation = duplicate line, which is expected while topping up
          skipped++;
          continue;
        }
        moodCount++;
        inserted++;
      }
      perMood[mood] = moodCount;
    }

    return jsonResponse({
      inserted,
      skipped,
      guarded,
      per_mood: perMood,
      dry_run: dryRun,
      model: lastModel,
      total_in_bank: (await supabase.from("twin_greeting_bank").select("id", { count: "exact", head: true })).count ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
});
