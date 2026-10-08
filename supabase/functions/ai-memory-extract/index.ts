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

// ai-memory-extract — "remember what matters in our chat" (Phase 5, reworked).
//
//   POST { partnerId? }  →  { added, heuristic, llm, highlights, llm_calls }
//
// Phase 5 replaced the old shape of this function (80 messages → one greedy
// model call every time it was tapped) with the same rule the nightly sweep
// follows: heuristics first, the model only for the top ~5%.
//
// 1. Free: `_shared/memory.ts` reads the last 200 real lines and pulls durable
//    facts straight out of their own sentences, plus the lines worth keeping.
// 2. Paid (at most ONE `extract` call, private tier): only if a line scored
//    high enough to be worth asking about. If it fails, the free pass stands.
//
// Contract kept: the app still gets `{ added }`. Everything else is extra.

interface ExtractedFact {
  fact: string;
  category: string;   // likes|dislikes|important|date|other
  about: string;      // the name the fact is about
}

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/memory.ts) ──
// ── BEGIN INLINE: memory.ts ──
/**
 * memory.ts — the free half of memory 2.0 (build-plan Phase 5).
 *
 * The rule this file exists to enforce: **the twin notices with heuristics and
 * only thinks with the model when it is worth it.** Everything here is pure —
 * no Deno, no clock of its own, no network — so it runs in the nightly sweep,
 * in the "remember what matters" button, and in the tests, identically.
 *
 * Three jobs:
 *   1. `extractHighlights()` — the lines worth keeping from a day: promises,
 *      plans, dates, firsts, feelings, gifts, places, milestones. English and
 *      Hinglish, because that is how they actually talk.
 *   2. `extractFactCandidates()` — durable facts ("loves filter coffee",
 *      "birthday is 12 March") straight out of their own sentences. These are
 *      inserted with no AI call at all.
 *   3. `selectWorthAsking()` — the top ~5%, the only lines worth one model call.
 *
 * Nothing here writes to the database; the edge functions own that.
 */

export type MemoryCategory = "likes" | "dislikes" | "important" | "date" | "other";

export interface DayLine {
  id: string;
  user_id: string;
  username?: string | null;
  content: string;
  created_at: string;
}

export interface HighlightCandidate {
  message_id: string;
  user_id: string;
  day: string;
  kind: string;
  text: string;
  score: number;
}

export interface FactCandidate {
  fact: string;
  category: MemoryCategory;
  /** Which side of the couple the fact is about, by id — never by name. */
  about: "owner" | "partner";
  kind: string | null;
  message_id: string;
  day: string;
  importance: number;
  quote: string;
}

/**
 * Kind patterns, most specific first. Each entry is a list of spellings —
 * English, Hindi and Hinglish — because a lexicon that only reads English
 * misses most of what these two write.
 */
const KIND_PATTERNS: { kind: string; weight: number; patterns: RegExp[] }[] = [
  {
    kind: "milestone",
    weight: 0.32,
    patterns: [
      /\b(engagement|engaged|proposal|propose|roka|sagai|shaadi|shadi|marriage|married|moved in|move in)\b/i,
      /\b(first anniversary|saalgirah)\b/i,
    ],
  },
  {
    kind: "promise",
    weight: 0.28,
    patterns: [
      /\b(i promise|promise you|pinky promise|i swear|you have my word)\b/i,
      /\b(pakka|vada|wada|kasam|vaada)\b/i,
      /\b(i(?:'ll| will) (?:definitely |surely )?(?:come|meet|be there|call|do it))\b/i,
    ],
  },
  {
    kind: "first",
    weight: 0.26,
    patterns: [/\b(first time|for the first time|pehli baar|pehla|pehli)\b/i],
  },
  {
    kind: "date",
    weight: 0.24,
    patterns: [
      /\b(birthday|janamdin|janmdin|happy bday|hbd|anniversary|saalgirah|dob|date of birth)\b/i,
      /\b(\d{1,2}(?:st|nd|rd|th)?\s?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i,
      /\b(\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)var)\b/i,
    ],
  },
  {
    kind: "gift",
    weight: 0.2,
    patterns: [
      /\b(gift|surprise|present)\b/i,
      /\b(laaya|layi|laye|diya|diye|bought you|got you)\b/i,
    ],
  },
  {
    kind: "place",
    weight: 0.16,
    patterns: [
      /\b(ghar|home|office|station|airport|cafe|restaurant|mandir|temple|hospital|market|chowk)\b/i,
      /\b(goa|manali|jaipur|delhi|mumbai|bangalore|pune|shimla|rishikesh|udaipur)\b/i,
    ],
  },
  {
    kind: "feeling",
    weight: 0.18,
    patterns: [
      /\b(i miss you|miss you|miss u|yaad aa rahi|yaad aata|tumhari yaad)\b/i,
      /\b(i love you|love you|love u|pyar|pyaar|jaan|baby)\b/i,
      /\b(sorry|maaf|gussa|hurt|loney|akela|thank you|grateful)\b/i,
    ],
  },
  {
    kind: "plan",
    weight: 0.14,
    patterns: [
      /\b(kal|tomorrow|next week|agle hafte|this weekend|tonight|aaj raat|milte hai|milna|meet up|dinner|movie|trip)\b/i,
      /\b(plan|decide kar|final kar)\b/i,
    ],
  },
];

const HEART_OR_SPARK = /[❤️💛💚💙💜🧡💕💖💗💓💞💘😍🥰😘😻🫶✨]/u;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/**
 * The same two filters the SQL side uses (`twin_is_ignored_message` /
 * `twin_is_placeholder_content`, from the Phase 1 tuning migration). Kept here
 * so a function that pulls its own `messages` rows still reads only real words.
 */
const MECHANICAL_TYPES = new Set(["touch_reaction", "reaction", "react", "coinflip", "rps", "bored", "system"]);
const PLACEHOLDER = /^\[(voice note|voice|sticker|gif|image|photo|video|file|document|media|deleted)\]$/i;
const ONLY_EMOJI = /^[\s\p{So}\p{Sk}\u200D\uFE0E\uFE0F]+$/u;

/** A tap, a game outcome, a system row — not something anyone said. */
function isMechanicalMessage(messageType: string | null | undefined): boolean {
  return MECHANICAL_TYPES.has(String(messageType ?? "text").toLowerCase());
}

/** A caption with no words in it. */
function isPlaceholderContent(content: string | null | undefined): boolean {
  const t = String(content ?? "").trim();
  return t === "" || PLACEHOLDER.test(t) || ONLY_EMOJI.test(t);
}

/** Strip a line down to text we can compare and store. */
function normalize(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(text: string, max = 180): string {
  return normalize(text).slice(0, max);
}

/** The first (most specific) kind that fits, or null. */
function kindOf(text: string): { kind: string; weight: number } | null {
  const t = String(text ?? "");
  for (const entry of KIND_PATTERNS) {
    if (entry.patterns.some((p) => p.test(t))) return { kind: entry.kind, weight: entry.weight };
  }
  return null;
}

/**
 * How much a line deserves to be kept. Deliberately boring: length in the
 * "says something" band, a kind, warmth, a concrete detail (a digit or a name).
 */
function highlightScore(text: string, kind: string | null): number {
  const t = normalize(text);
  if (t.length < 8) return 0;

  let score = 0.3;
  if (t.length >= 24 && t.length <= 220) score += 0.12;
  if (t.length >= 60) score += 0.05;
  if (t.length < 14) score -= 0.12;

  const entry = KIND_PATTERNS.find((e) => e.kind === kind);
  if (entry) score += entry.weight;

  if (HEART_OR_SPARK.test(t)) score += 0.12;
  else if (EMOJI.test(t)) score += 0.05;
  if (/[!]/.test(t)) score += 0.05;
  if (/\d/.test(t)) score += 0.06;
  if (/\b(sirf|always|never|sabse|favourite|favorite|best)\b/i.test(t)) score += 0.06;
  if (t.endsWith("?")) score -= 0.08;
  // A wall of forwarded text is not a memory.
  if (/^https?:\/\//.test(t)) score -= 0.3;

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

/**
 * Keep the lines worth remembering from one day. At most `maxPerDay`, never the
 * same sentence twice, strongest first. `minScore` is the bar for a line with
 * no recognized kind to still qualify (as "other").
 */
function extractHighlights(
  lines: DayLine[],
  opts: { day: string; maxPerDay?: number; minScore?: number } = { day: "" },
): HighlightCandidate[] {
  const maxPerDay = Math.max(1, opts.maxPerDay ?? 4);
  const minScore = opts.minScore ?? 0.45;
  const seen = new Set<string>();
  const out: HighlightCandidate[] = [];

  for (const line of lines ?? []) {
    const text = clean(line.content);
    if (text.length < 8) continue;

    const found = kindOf(text);
    const kind = found?.kind ?? "other";
    const score = highlightScore(text, found?.kind ?? null);
    if (!found && score < Math.max(minScore, 0.6)) continue;
    if (score < 0.35) continue;

    const key = `${kind}:${text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F ]+/gi, "").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      message_id: line.id,
      user_id: line.user_id,
      day: opts.day || (line.created_at ?? "").slice(0, 10),
      kind,
      text,
      score,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, maxPerDay);
}

/** Sentence-ish splitter used by the fact patterns. */
function sentences(text: string): string[] {
  return normalize(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Tidy a captured phrase into something a person would recognize: no leading
 * "mujhe / hai / that", no trailing "hai / is", no dangling punctuation.
 * Hinglish word order puts the verb at the end, so both ends need work.
 */
function phrase(text: string, max = 45, cutClause = false): string {
  const base = cutClause ? clean(text, max).split(/[;,]/)[0] : clean(text, max);
  return base
    .replace(/^(?:mujhe|mujhko|mein|main|mai|i|to|that|ki|ka|ke|hai|h|is)\s+/i, "")
    .replace(/\s+(?:hai|h|is|tha|thi|the|raha|rahi|rahe|kar|karna|hoti|hota)$/i, "")
    .replace(/[.!,;:\s]+$/, "")
    .trim();
}

const FACT_PATTERNS: { category: MemoryCategory; build: (m: RegExpMatchArray) => string | null; pattern: RegExp }[] = [
  // "my favourite food is rajma chawal" / "mera favourite colour blue hai"
  {
    category: "likes",
    pattern: /\b(?:my|mera|meri|apna)\s+(?:favourite|favorite|fav)\s+(.{2,30}?)\s+(?:is|hai|h)\s+(.{2,40})/i,
    build: (m) => {
      const what = phrase(m[1], 30, true);
      const value = phrase(m[2], 40, true);
      return what && value ? `favourite ${what}: ${value}` : null;
    },
  },
  // "I love filter coffee" / "mujhe barish bahut pasand hai"
  {
    category: "likes",
    pattern: /\b(?:i|main|mai|mein|mujhe|hum)\s+(?:really\s+|bahut\s+|bohot\s+|too\s+)?(?:love|like|pasand)\s+(?:to\s+)?(.{3,45})/i,
    build: (m) => {
      const v = phrase(m[1], 45, true);
      return v.length >= 3 ? `loves ${v}` : null;
    },
  },
  // "I hate crowds" / "mujhe noise pasand nahi"
  {
    category: "dislikes",
    pattern: /\b(?:i|main|mai|mujhe)\s+(?:really\s+|bahut\s+|bohot\s+)?(?:hate|dislike|can't stand|cant stand)\s+(.{3,45})/i,
    build: (m) => {
      const v = phrase(m[1], 45, true);
      return v.length >= 3 ? `dislikes ${v}` : null;
    },
  },
  {
    category: "dislikes",
    pattern: /\b(.{3,40}?)\s+pasand nahi\b/i,
    build: (m) => {
      const v = phrase(m[1], 40, true);
      return v.length >= 3 ? `dislikes ${v}` : null;
    },
  },
  // "allergic to peanuts"
  {
    category: "important",
    pattern: /\ballergic to\s+(.{2,40})/i,
    build: (m) => `allergic to ${clean(m[1], 40)}`,
  },
  // "remember I have an exam on the 12th"
  {
    category: "important",
    pattern: /\b(?:remember|yaad rakhna|note kar|don't forget|dont forget|bhoolna nahi)\b[:,]?\s*(.{4,90})/i,
    build: (m) => {
      const v = clean(m[1], 90).replace(/[.!,;:\s]+$/, "");
      return v.length >= 4 ? `remember: ${v}` : null;
    },
  },
  // "my birthday is 12 March" / "mera birthday 12 march hai"
  {
    category: "date",
    pattern:
      /\b(?:my|mera|meri|tumhara|your)?\s*(birthday|janamdin|janmdin|anniversary|saalgirah)\b[^0-9]{0,14}(\d{1,2}(?:st|nd|rd|th)?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{1,2}(?:st|nd|rd|th)?)/i,
    build: (m) => {
      const what = clean(m[1], 20).toLowerCase();
      const when = phrase(m[2], 20);
      return when ? `${what}: ${when}` : null;
    },
  },
];

/**
 * Durable facts from their own sentences — no AI, no guessing. Precision beats
 * recall on purpose: a wrong memory is worse than a missing one.
 */
function extractFactCandidates(
  lines: DayLine[],
  opts: { ownerId: string; max?: number; day?: string },
): FactCandidate[] {
  const max = Math.max(1, opts.max ?? 8);
  const out: FactCandidate[] = [];
  const seen = new Set<string>();

  for (const line of lines ?? []) {
    const text = normalize(line.content);
    if (text.length < 8) continue;

    const day = opts.day || (line.created_at ?? "").slice(0, 10);
    const found = kindOf(text);
    const about: "owner" | "partner" = line.user_id === opts.ownerId ? "owner" : "partner";

    for (const { category, pattern, build } of FACT_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;
      const fact = build(match);
      if (!fact) continue;

      const key = fact.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        fact,
        category,
        about,
        kind: found?.kind ?? null,
        message_id: line.id,
        day,
        importance: Number(
          Math.min(1, 0.4 + (category === "important" ? 0.25 : category === "date" ? 0.3 : 0.15)).toFixed(3),
        ),
        quote: clean(text, 120),
      });
      break; // one fact per sentence is plenty
    }
  }

  return out.slice(0, max);
}

/** Higher = more worth remembering. Recency is the only clock used. */
function importanceOf(candidate: { kind?: string | null; importance?: number; day?: string | null }, today?: string): number {
  let base = candidate.importance ?? 0.5;
  const entry = KIND_PATTERNS.find((e) => e.kind === candidate.kind);
  if (entry) base = Math.max(base, 0.45 + entry.weight);
  if (candidate.day && today) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${candidate.day}T00:00:00Z`)) / 86_400_000);
    if (Number.isFinite(days)) base += days <= 2 ? 0.1 : days <= 7 ? 0.05 : 0;
  }
  return Math.max(0, Math.min(1, Number(base.toFixed(3))));
}

/**
 * The top slice — the only lines worth a model call (plan §Phase 5: heuristics
 * for everything, LLM for the top 5%). Always capped, never zero when there is
 * something good to ask about.
 */
function selectWorthAsking<T extends { importance?: number; score?: number }>(
  candidates: T[],
  opts: { percent?: number; cap?: number; minImportance?: number } = {},
): T[] {
  const percent = Math.max(1, Math.min(100, opts.percent ?? 5));
  const cap = Math.max(0, opts.cap ?? 2);
  const minImportance = opts.minImportance ?? 0.6;

  const ranked = [...(candidates ?? [])].sort(
    (a, b) => (b.importance ?? b.score ?? 0) - (a.importance ?? a.score ?? 0),
  );
  if (ranked.length === 0 || cap === 0) return [];

  const take = Math.max(1, Math.min(cap, Math.ceil((ranked.length * percent) / 100)));
  return ranked.filter((c) => (c.importance ?? c.score ?? 0) >= minImportance).slice(0, take);
}

/** Facts that say the same thing, however they were phrased. */
function dedupeFacts<T extends { fact: string }>(facts: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const f of facts ?? []) {
    const key = normalize(f.fact)
      .toLowerCase()
      .replace(/^(loves|dislikes|likes|remember:)\s*/, "")
      .replace(/[^a-z0-9\u0900-\u097F ]+/gi, "")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** The one prompt the sweep may spend a call on (build-plan §5 / Phase 5). */
function buildMemoryPrompt(
  lines: { who: string; text: string }[],
  names: { ownerName: string; partnerName: string },
): { system: string; user: string } {
  const system =
    `You read a few lines a couple wrote to each other and extract only facts that will still be true in a month. ` +
    `People: ${names.ownerName} (him), ${names.partnerName} (her). ` +
    `Capture preferences, favourites, dates, allergies, people, places, promises that matter — NOT moods, plans for tomorrow, or chatter. ` +
    `Write each fact as a short third-person phrase (max 12 words), in English, e.g. "loves filter coffee", "birthday is 12 March". ` +
    `Reply with ONLY JSON: {"facts":[{"fact":"...","category":"likes|dislikes|important|date|other","about":"${names.ownerName}|${names.partnerName}"}]}. ` +
    `At most 5 facts. If nothing is durable, return {"facts":[]}.`;

  const user = lines.map((l) => `${l.who}: ${l.text}`).join("\n");
  return { system, user: `Lines:\n${user}` };
}

/** Pull the good stuff out of one day, in one call. */
function summarizeDay(
  lines: DayLine[],
  opts: { day: string; ownerId: string; maxHighlights?: number; maxFacts?: number },
): { highlights: HighlightCandidate[]; facts: FactCandidate[] } {
  return {
    highlights: extractHighlights(lines, { day: opts.day, maxPerDay: opts.maxHighlights ?? 4 }),
    facts: extractFactCandidates(lines, { ownerId: opts.ownerId, day: opts.day, max: opts.maxFacts ?? 6 }),
  };
}

export type { DayLine as MemoryDayLine };
export {
  buildMemoryPrompt,
  clean,
  dedupeFacts,
  extractFactCandidates,
  extractHighlights,
  highlightScore,
  importanceOf,
  isMechanicalMessage,
  isPlaceholderContent,
  phrase,
  KIND_PATTERNS,
  kindOf,
  normalize,
  selectWorthAsking,
  summarizeDay,
};
// ── END INLINE: memory.ts ──
// ── END GENERATED BLOCK ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, supabase } = await requirePartner(req);
    const body = await req.json().catch(() => ({}));
    const partnerId: string | undefined = body?.partnerId;

    const { data: cfg } = await supabase.from("twin_config").select("*").eq("id", 1).maybeSingle();
    const ownerId: string = cfg?.owner_user_id ?? userId;
    const partnerUserId: string | undefined = cfg?.partner_user_id ?? partnerId;
    const ownerName: string = cfg?.owner_name ?? "him";
    const partnerName: string = cfg?.partner_name ?? "her";

    // Names → ids, so a fact is attributed to a person and not a string.
    const { data: statuses } = await supabase.from("user_status").select("user_id, name");
    const nameToId = new Map<string, string>(
      (statuses ?? [])
        .filter((s: { name: string | null }) => s.name)
        .map((s: { user_id: string; name: string }) => [s.name.toLowerCase(), s.user_id]),
    );
    nameToId.set(ownerName.toLowerCase(), ownerId);
    if (partnerUserId) nameToId.set(partnerName.toLowerCase(), partnerUserId);

    // The last 200 real lines of the shared chat, oldest first (read only).
    const { data: recent } = await supabase
      .from("messages")
      .select("id, user_id, username, content, created_at, message_type")
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const lines = ((recent ?? []) as DayLineRow[])
      .slice()
      .reverse()
      .filter((m) => !isMechanicalMessage(m.message_type) && !isPlaceholderContent(m.content))
      .map((m) => ({
        id: m.id,
        user_id: m.user_id,
        username: m.username,
        content: m.content ?? "",
        created_at: m.created_at,
      }));

    if (lines.length === 0) return jsonResponse({ added: 0, heuristic: 0, llm: 0, highlights: 0 });

    const istToday = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    const day = istToday;

    // ── 1. free pass ────────────────────────────────────────────────────────
    const highlights = extractHighlights(lines, { day: "", maxPerDay: 10 });
    const facts = extractFactCandidates(lines, { ownerId, max: 12, day: "" });

    let added = 0;
    for (const fact of facts) {
      const subject = fact.about === "owner" ? ownerId : partnerUserId;
      if (!subject) continue;
      const { data: saved } = await supabase.rpc("twin_memory_upsert", {
        p_subject: subject,
        p_fact: fact.fact,
        p_category: fact.category,
        p_source: "auto",
        p_confidence: 0.55,
        p_importance: importanceOf(fact, istToday),
        p_day: fact.day || day,
        p_message_id: fact.message_id,
        p_kind: fact.kind,
        p_owner: userId,
      });
      if (saved?.ok) added += 1;
    }

    let highlightsStored = 0;
    const byDay = new Map<string, typeof highlights>();
    for (const h of highlights) {
      const list = byDay.get(h.day) ?? [];
      list.push(h);
      byDay.set(h.day, list);
    }
    for (const [dayKey, list] of byDay) {
      const { data: existing } = await supabase.from("message_highlights").select("text").eq("day", dayKey);
      const known = new Set((existing ?? []).map((r: { text: string }) => r.text.toLowerCase()));
      const fresh = list.filter((h) => !known.has(h.text.toLowerCase()));
      if (fresh.length === 0) continue;
      const { error } = await supabase.from("message_highlights").insert(
        fresh.map((h) => ({
          message_id: h.message_id,
          user_id: h.user_id,
          day: h.day,
          kind: h.kind,
          text: h.text,
          score: h.score,
          source: "heuristic",
        })),
      );
      if (!error) highlightsStored += fresh.length;
    }

    // ── 2. the one paid step: the top ~5% ───────────────────────────────────
    let factsLlm = 0;
    let llmCalls = 0;
    let tokens = 0;

    const worth = selectWorthAsking(highlights, { percent: 5, cap: 1, minImportance: 0.6 });
    if (worth.length > 0) {
      try {
        const prompt = buildMemoryPrompt(
          worth.map((h) => ({ who: h.user_id === ownerId ? ownerName : partnerName, text: h.text })),
          { ownerName, partnerName },
        );
        const result = await callLLM({
          task: "extract",
          sensitivity: "private",
          tag: "memory-extract",
          userId,
          json: true,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });
        llmCalls += 1;
        tokens += (result.tokensIn ?? 0) + (result.tokensOut ?? 0);

        const parsed = parseJsonLoose<{ facts?: ExtractedFact[] }>(result.text);
        const returned = dedupeFacts(
          (parsed?.facts ?? [])
            .filter((f) => f.fact && f.fact.trim().length >= 4)
            .map((f) => ({ fact: String(f.fact).trim(), category: f.category ?? "other", about: f.about ?? "" })),
        ).slice(0, 5);

        for (const f of returned) {
          const subject = nameToId.get(String(f.about).toLowerCase());
          if (!subject || subject === undefined) continue;
          if (subject !== ownerId && subject !== partnerUserId) continue;
          const { data: saved } = await supabase.rpc("twin_memory_upsert", {
            p_subject: subject,
            p_fact: f.fact,
            p_category: f.category,
            p_source: "auto",
            p_confidence: 0.8,
            p_importance: 0.7,
            p_day: worth[0]?.day ?? day,
            p_owner: userId,
          });
          if (saved?.ok) {
            added += 1;
            factsLlm += 1;
          }
        }
      } catch (e) {
        // heuristics already did the useful part; never fail the request for this
        console.error("memory extract LLM step failed:", e instanceof Error ? e.message : e);
      }
    }

    return jsonResponse({
      added,
      heuristic: facts.length,
      llm: factsLlm,
      highlights: highlightsStored,
      llm_calls: llmCalls,
      tokens,
      scanned: lines.length,
    });
  } catch (e) {
    return errorResponse(e);
  }
});

interface DayLineRow {
  id: string;
  user_id: string;
  username: string | null;
  content: string | null;
  created_at: string;
  message_type: string | null;
}
