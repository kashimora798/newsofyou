// Semantic checker for the drawing game.
// Input:  { guess, answer }
// Output: { match: boolean, type?: "exact" | "partial" | "synonym" | "close" | "no_match" }
//
// Cheap local checks run first (exact / substring) so the vast majority of
// guesses never touch an LLM at all. Only genuinely ambiguous guesses are sent
// to the shared router, with a tiny output budget (classify task).

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/llm.ts) ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

type LlmTask =
  | "classify"
  | "json"
  | "chat"
  | "creative"
  | "hint"
  | "summary"
  | "decoy"
  | "twin";

interface LlmCallOptions {
  messages: ChatMessage[];
  /** Routing profile. Default: "chat". */
  task?: LlmTask;
  temperature?: number;
  /** Hard cap on generated tokens (also clamped by the task profile). */
  maxTokens?: number;
  json?: boolean;
  /** Force a model: "provider:model" or a bare model id. */
  model?: string;
  /** Restrict to these provider ids. */
  providers?: string[];
  /** 0 / undefined = do not cache. Only opt in for non-personal prompts. */
  cacheTtlSeconds?: number;
  /** Extra salt so two prompts can never collide in the cache. */
  cacheKey?: string;
  /** Enables daily budget accounting + degradation. */
  userId?: string;
  /** "soft" (default) degrades, "strict" throws once the budget is blown. */
  budgetMode?: "soft" | "strict";
  timeoutMs?: number;
  /** Free-form label that lands in ai_llm_events, e.g. "hangman-hint". */
  tag?: string;
  /** Override the task input budget (in approx. tokens). */
  trimTo?: number;
  /** Personal prompts are never cached and never logged with content. */
  personal?: boolean;
}

interface LlmResult {
  text: string;
  model: string;
  provider: string;
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

// ── tiny env/util helpers (Deno-safe, also importable from plain Node) ──

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
      // The newest message alone blows the budget — keep its head.
      const room = Math.max(48, (budget - 4) * 4);
      kept.unshift({
        role: m.role,
        content: m.content.slice(0, room) + "\n…[truncated]",
      });
      budget = 0;
    }
    break;
  }

  const dropped = rest.length - kept.length;
  const out = [...systems, ...(dropped > 0 ? [{ role: "system" as ChatRole, content: `[${dropped} earlier message(s) omitted]` }] : []), ...kept];
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

// ── providers (all free tier) ─────────────────────────────────────────────

interface ProviderDef {
  id: string;
  label: string;
  envKeys: string[];
  url: string;
  fast: string[];
  strong: string[];
  /** Billable-free note, shown in error messages. */
  note: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    envKeys: ["OPENROUTER_API_KEY"],
    url: "https://openrouter.ai/api/v1/chat/completions",
    fast: [
      "google/gemma-4-26b-a4b-it:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "google/gemma-2-9b-it:free",
    ],
    strong: [
      "nex-agi/nex-n2-pro:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "google/gemma-4-31b-it:free",
    ],
    note: "free models",
  },
  {
    id: "groq",
    label: "Groq",
    envKeys: ["GROQ_API_KEY"],
    url: "https://api.groq.com/openai/v1/chat/completions",
    fast: ["llama-3.1-8b-instant"],
    strong: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
    note: "free tier",
  },
  {
    id: "gemini",
    label: "Google AI Studio",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"],
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    fast: ["gemini-2.0-flash-lite"],
    strong: ["gemini-2.0-flash", "gemini-2.5-flash"],
    note: "free tier",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    envKeys: ["CEREBRAS_API_KEY"],
    url: "https://api.cerebras.ai/v1/chat/completions",
    fast: ["llama3.1-8b"],
    strong: ["llama-3.3-70b"],
    note: "free tier",
  },
  {
    id: "lovable",
    label: "Lovable gateway",
    envKeys: ["LOVABLE_API_KEY"],
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    fast: ["google/gemini-3-flash-preview"],
    strong: ["google/gemini-3-flash-preview"],
    note: "legacy gateway",
  },
];

function providerKey(p: ProviderDef): string | undefined {
  for (const k of p.envKeys) {
    const v = envGet(k);
    if (v) return v;
  }
  return undefined;
}

function disabledProviders(): string[] {
  return (envGet("LLM_DISABLED_PROVIDERS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** `provider:model` entries that are prepended to every candidate list. */
function envModelPool(): { tier: "fast" | "strong"; entry: string }[] {
  const out: { tier: "fast" | "strong"; entry: string }[] = [];
  const parse = (raw: string | undefined, tier: "fast" | "strong") => {
    for (const entry of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      out.push({ tier, entry });
    }
  };
  parse(envGet("LLM_POOL_FAST"), "fast");
  parse(envGet("LLM_POOL_STRONG"), "strong");
  return out;
}

// ── task profiles ─────────────────────────────────────────────────────────

interface TaskProfile {
  temperature: number;
  maxTokens: number;
  tier: "fast" | "strong";
  json: boolean;
  maxInputTokens: number;
  cacheTtlSeconds: number;
  timeoutMs: number;
}

const TASK_PROFILES: Record<LlmTask, TaskProfile> = {
  // Yes/no or tiny structured answers — cheapest possible model.
  classify: { temperature: 0, maxTokens: 32, tier: "fast", json: true, maxInputTokens: 1200, cacheTtlSeconds: 86400, timeoutMs: 12000 },
  // Structured extraction, 1-3 sentence prose answers.
  json: { temperature: 0.4, maxTokens: 400, tier: "fast", json: true, maxInputTokens: 2500, cacheTtlSeconds: 0, timeoutMs: 20000 },
  // Conversational replies the user is waiting on.
  chat: { temperature: 0.7, maxTokens: 320, tier: "fast", json: false, maxInputTokens: 3000, cacheTtlSeconds: 0, timeoutMs: 25000 },
  // Questions / starters / one-off prompts — cached per day where safe.
  creative: { temperature: 0.9, maxTokens: 220, tier: "strong", json: false, maxInputTokens: 1200, cacheTtlSeconds: 43200, timeoutMs: 20000 },
  // One-liner hints; tiny budget, cache friendly.
  hint: { temperature: 0.9, maxTokens: 80, tier: "fast", json: false, maxInputTokens: 800, cacheTtlSeconds: 0, timeoutMs: 12000 },
  summary: { temperature: 0.5, maxTokens: 340, tier: "fast", json: false, maxInputTokens: 4000, cacheTtlSeconds: 3600, timeoutMs: 25000 },
  // Longest output: the decoy has to look like a real assistant.
  decoy: { temperature: 0.7, maxTokens: 500, tier: "strong", json: false, maxInputTokens: 3000, cacheTtlSeconds: 0, timeoutMs: 30000 },
  // Phase 1 "twin" replies — warm, personal, never cached.
  twin: { temperature: 0.85, maxTokens: 260, tier: "strong", json: false, maxInputTokens: 3500, cacheTtlSeconds: 0, timeoutMs: 25000 },
};

// ── service client (best effort; router works with no DB at all) ──────────

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

function fireAndForget(p: unknown): void {
  try {
    Promise.resolve(p).catch(() => {});
  } catch {
    /* never let telemetry break a reply */
  }
}

// ── health memory (in-process + persisted across instances) ───────────────

interface ModelStat {
  provider: string;
  model: string;
  ok_count: number;
  fail_count: number;
  avg_latency_ms: number;
  cooldown_until: string | null;
}

const cooldowns = new Map<string, number>(); // "provider:model" -> epoch ms
const providerCooldowns = new Map<string, number>();
let statsCache = new Map<string, ModelStat>();
let statsLoadedAt = 0;

const statKey = (provider: string, model: string) => `${provider}:${model}`;

function coolingMs(provider: string, model: string): number {
  const until = Math.max(
    cooldowns.get(statKey(provider, model)) ?? 0,
    providerCooldowns.get(provider) ?? 0,
    Date.parse(statsCache.get(statKey(provider, model))?.cooldown_until ?? "") || 0,
  );
  return Math.max(0, until - Date.now());
}

function setCooldown(provider: string, model: string, seconds: number): void {
  const until = Date.now() + seconds * 1000;
  cooldowns.set(statKey(provider, model), until);
}

async function loadStats(): Promise<void> {
  if (Date.now() - statsLoadedAt < 60_000) return;
  statsLoadedAt = Date.now();
  const sb = await adminClient();
  if (!sb) return;
  try {
    const { data } = await withTimeout<any>(
      sb.from("ai_llm_stats").select("provider,model,ok_count,fail_count,avg_latency_ms,cooldown_until").limit(200),
      2000,
      "loadStats",
    );
    if (Array.isArray(data)) {
      const next = new Map<string, ModelStat>();
      for (const row of data as ModelStat[]) next.set(statKey(row.provider, row.model), row);
      statsCache = next;
    }
  } catch {
    /* stats are an optimisation, never a dependency */
  }
}

function recordStat(provider: string, model: string, ok: boolean, latencyMs: number, cooldownSeconds: number): void {
  const key = statKey(provider, model);
  const prev = statsCache.get(key) ?? {
    provider,
    model,
    ok_count: 0,
    fail_count: 0,
    avg_latency_ms: 0,
    cooldown_until: null,
  };
  const next: ModelStat = {
    provider,
    model,
    ok_count: prev.ok_count + (ok ? 1 : 0),
    fail_count: prev.fail_count + (ok ? 0 : 1),
    avg_latency_ms: ok && latencyMs > 0
      ? Math.round(prev.avg_latency_ms > 0 ? prev.avg_latency_ms * 0.7 + latencyMs * 0.3 : latencyMs)
      : prev.avg_latency_ms,
    cooldown_until: cooldownSeconds > 0 ? new Date(Date.now() + cooldownSeconds * 1000).toISOString() : prev.cooldown_until,
  };
  statsCache.set(key, next);
  if (cooldownSeconds > 0) setCooldown(provider, model, cooldownSeconds);
  void (async () => {
    const sb = await adminClient();
    if (!sb) return;
    try {
      await sb.rpc("ai_llm_stat_record", {
        p_provider: provider,
        p_model: model,
        p_ok: ok,
        p_latency_ms: Math.round(latencyMs),
        p_cooldown_seconds: cooldownSeconds,
      });
    } catch {
      /* ignore */
    }
  })();
}

// ── per-user daily budget ─────────────────────────────────────────────────

const usageCache = new Map<string, { used: number; at: number }>();

interface BudgetState {
  used: number;
  limit: number;
  degraded: boolean;
  blocked: boolean;
}

function dailyTokenBudget(): number {
  const raw = Number(envGet("LLM_DAILY_TOKEN_BUDGET") ?? "20000");
  return Number.isFinite(raw) && raw > 0 ? raw : 20000;
}

async function budgetState(userId: string | undefined, mode: "soft" | "strict"): Promise<BudgetState> {
  const limit = dailyTokenBudget();
  if (!userId) return { used: 0, limit, degraded: false, blocked: false };

  const cached = usageCache.get(userId);
  let used = cached && Date.now() - cached.at < 30_000 ? cached.used : -1;

  if (used < 0) {
    used = 0;
    const sb = await adminClient();
    if (sb) {
      try {
        const day = new Date().toISOString().slice(0, 10);
        const { data } = await withTimeout<any>(
          sb.from("ai_usage_daily").select("tokens_in,tokens_out").eq("user_id", userId).eq("day", day).maybeSingle(),
          2000,
          "budgetState",
        );
        used = Number(data?.tokens_in ?? 0) + Number(data?.tokens_out ?? 0);
      } catch {
        used = 0;
      }
    }
    usageCache.set(userId, { used, at: Date.now() });
  }

  return {
    used,
    limit,
    degraded: used >= limit,
    blocked: mode === "strict" && used >= limit * 3,
  };
}

function bumpUsage(userId: string | undefined, tokensIn: number, tokensOut: number): void {
  if (!userId) return;
  const cached = usageCache.get(userId);
  if (cached) cached.used += tokensIn + tokensOut;
  void (async () => {
    const sb = await adminClient();
    if (!sb) return;
    try {
      await sb.rpc("ai_usage_bump", { p_user: userId, p_in: tokensIn, p_out: tokensOut });
    } catch {
      /* ignore */
    }
  })();
}

// ── response cache + request coalescing ───────────────────────────────────

const inflight = new Map<string, Promise<LlmResult>>();

async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Extremely defensive fallback (no subtle crypto available).
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
      sb.from("ai_llm_cache").select("response,provider,model,created_at").eq("cache_key", key).gt("expires_at", new Date().toISOString()).maybeSingle(),
      2000,
      "cacheGet",
    );
    if (!data?.response) return null;
    return {
      text: data.response as string,
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

function cachePut(key: string, task: string, result: LlmResult, ttlSeconds: number): void {
  void (async () => {
    const sb = await adminClient();
    if (!sb) return;
    try {
      await sb.from("ai_llm_cache").upsert({
        cache_key: key,
        task,
        response: result.text,
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

// ── event log ─────────────────────────────────────────────────────────────

function recordEvent(row: Record<string, unknown>): void {
  void (async () => {
    const sb = await adminClient();
    if (!sb) return;
    try {
      await sb.from("ai_llm_events").insert({ created_at: new Date().toISOString(), ...row });
    } catch {
      /* ignore */
    }
  })();
}

// ── routing ───────────────────────────────────────────────────────────────

interface Candidate {
  provider: ProviderDef;
  model: string;
  key: string;
  score: number;
}

function scoreCandidate(provider: string, model: string, tier: "fast" | "strong", preferred: string | undefined): number {
  const stat = statsCache.get(statKey(provider, model));
  const ok = Number(stat?.ok_count ?? 0);
  const fail = Number(stat?.fail_count ?? 0);
  const success = ok / (ok + fail + 1);
  const latency = Number(stat?.avg_latency_ms ?? 0) || 1500;
  let score = success * 100 - latency / 40 - fail * 2;
  if (preferred && provider === preferred) score += 25;
  if (tier === "fast" && provider === "groq") score += 6; // very low latency on free tier
  return score;
}

/** Which model list a provider offers for a tier, plus the other tier as backup. */
function modelsFor(p: ProviderDef, tier: "fast" | "strong"): string[] {
  const primary = tier === "fast" ? p.fast : p.strong;
  const secondary = tier === "fast" ? p.strong : p.fast;
  return [...primary, ...secondary];
}

function buildCandidates(tier: "fast" | "strong", opts: LlmCallOptions): Candidate[] {
  const disabled = disabledProviders();
  const allowed = opts.providers?.map((p) => p.toLowerCase());
  const preferred = envGet("LLM_PREFER_PROVIDER")?.toLowerCase();
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const push = (p: ProviderDef, model: string) => {
    const key = statKey(p.id, model);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ provider: p, model, key, score: scoreCandidate(p.id, model, tier, preferred) });
  };

  // Explicit pool overrides first (highest priority).
  for (const { tier: t, entry } of envModelPool()) {
    if (t !== tier) continue;
    const [maybeProvider, ...rest] = entry.split(":");
    const p = PROVIDERS.find((x) => x.id === maybeProvider);
    if (p && rest.length > 0 && providerKey(p)) push(p, rest.join(":"));
    else if (rest.length === 0) {
      for (const prov of PROVIDERS) if (providerKey(prov) && prov.fast.includes(maybeProvider)) push(prov, maybeProvider);
    }
  }

  for (const p of PROVIDERS) {
    if (!providerKey(p)) continue;
    if (disabled.includes(p.id)) continue;
    if (allowed && !allowed.includes(p.id)) continue;
    for (const model of modelsFor(p, tier)) push(p, model);
  }

  const healthy = out.filter((c) => coolingMs(c.provider.id, c.model) === 0);
  const pool = (healthy.length > 0 ? healthy : out).sort((a, b) => b.score - a.score);
  return pool;
}

function parseForcedModel(forced: string): { providerId?: string; model: string } {
  const idx = forced.indexOf(":");
  if (idx > 0 && PROVIDERS.some((p) => p.id === forced.slice(0, idx))) {
    return { providerId: forced.slice(0, idx), model: forced.slice(idx + 1) };
  }
  return { model: forced };
}

interface AttemptOutcome {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

function cooldownFor(status: number, attemptCount: number): number {
  if (status === 429) return Math.min(60 * attemptCount, 300);
  if (status === 402) return 900;
  if (status === 404) return 3600;
  if (status === 504) return 60;
  if (status >= 500) return 120;
  return 0;
}

async function callProvider(
  c: Candidate,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  json: boolean,
  timeoutMs: number,
  apiKey: string,
): Promise<AttemptOutcome> {
  const started = Date.now();
  const body: Record<string, unknown> = {
    model: c.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  if (json) body.response_format = { type: "json_object" };

  const doFetch = async (withJsonMode: boolean): Promise<Response> => {
    const payload = { ...body };
    if (!withJsonMode) delete payload.response_format;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(c.provider.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
    recordStat(c.provider.id, c.model, false, Date.now() - started, 60);
    throw new AiError(504, `${c.provider.label}/${c.model}: ${e instanceof Error ? e.message : "network error"}`);
  }

  if (!res.ok) {
    const cooldown = cooldownFor(res.status, 1);
    recordStat(c.provider.id, c.model, false, Date.now() - started, cooldown);
    if (res.status === 402) {
      providerCooldowns.set(c.provider.id, Date.now() + 900_000);
    }
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 160);
    } catch {
      /* ignore */
    }
    throw new AiError(res.status === 429 ? 429 : 502, `${c.provider.label}/${c.model} ${res.status} ${detail}`.trim());
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    recordStat(c.provider.id, c.model, false, Date.now() - started, 30);
    throw new AiError(502, `${c.provider.label}/${c.model}: invalid JSON`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length === 0) {
    recordStat(c.provider.id, c.model, false, Date.now() - started, 30);
    throw new AiError(502, `${c.provider.label}/${c.model}: empty response`);
  }

  recordStat(c.provider.id, c.model, true, Date.now() - started, 0);
  return {
    text,
    tokensIn: Number(data?.usage?.prompt_tokens ?? 0),
    tokensOut: Number(data?.usage?.completion_tokens ?? 0),
  };
}

async function callLLM(opts: LlmCallOptions): Promise<LlmResult> {
  const started = Date.now();
  const task: LlmTask = opts.task ?? "chat";
  const profile = TASK_PROFILES[task] ?? TASK_PROFILES.chat;
  const json = opts.json ?? profile.json;
  const temperature = opts.temperature ?? profile.temperature;
  const timeoutMs = opts.timeoutMs ?? profile.timeoutMs;
  const maxInputTokens = opts.trimTo ?? profile.maxInputTokens;

  const trimmed = trimMessages(opts.messages ?? [], maxInputTokens);

  const budget = await budgetState(opts.userId, opts.budgetMode ?? "soft");
  if (budget.blocked) {
    recordEvent({ user_id: opts.userId ?? null, tag: opts.tag ?? null, task, ok: false, error: "budget", tokens_in: trimmed.tokens, tokens_out: 0, latency_ms: Date.now() - started, attempts: 0 });
    throw new AiError(429, "Daily AI limit reached — try again tomorrow.");
  }
  const degraded = budget.degraded;
  const tier: "fast" | "strong" = degraded ? "fast" : profile.tier;
  const maxTokens = Math.max(
    16,
    Math.min(opts.maxTokens ?? profile.maxTokens, degraded ? Math.min(120, profile.maxTokens) : profile.maxTokens),
  );

  // Cache — opt in only, and never for personal prompts.
  const cacheTtl = opts.personal ? 0 : opts.cacheTtlSeconds ?? profile.cacheTtlSeconds;
  const cacheable = cacheTtl > 0;
  const cacheKey = cacheable
    ? await sha256(
        [
          "v1",
          task,
          String(json),
          String(temperature),
          String(maxTokens),
          opts.cacheKey ?? "",
          trimmed.messages.map((m) => `${m.role}:${m.content}`).join("\n"),
        ].join("|"),
      )
    : "";

  if (cacheable) {
    const hit = await cacheGet(cacheKey);
    if (hit) {
      recordEvent({ user_id: opts.userId ?? null, tag: opts.tag ?? null, task, provider: hit.provider, model: hit.model, ok: true, cached: true, degraded, attempts: 0, tokens_in: trimmed.tokens, tokens_out: estimateTokens(hit.text), latency_ms: Date.now() - started });
      return { ...hit, tokensIn: trimmed.tokens, tokensOut: estimateTokens(hit.text), latencyMs: Date.now() - started };
    }
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
  }

  const run = async (): Promise<LlmResult> => {
    await loadStats();
    const forced = opts.model ? parseForcedModel(opts.model) : null;
    let candidates = buildCandidates(tier, opts);
    if (forced) {
      const pinned: Candidate[] = [];
      for (const p of PROVIDERS) {
        if (!providerKey(p)) continue;
        if (forced.providerId && p.id !== forced.providerId) continue;
        if (!forced.providerId && ![...p.fast, ...p.strong].includes(forced.model)) continue;
        pinned.push({ provider: p, model: forced.model, key: statKey(p.id, forced.model), score: 1000 });
      }
      if (pinned.length > 0) {
        const rest = candidates.filter((c) => !pinned.some((p) => p.key === c.key));
        candidates = [...pinned, ...rest];
      }
    }
    candidates = candidates.slice(0, 4);
    if (candidates.length === 0) {
      throw new AiError(500, "No LLM provider configured — set OPENROUTER_API_KEY (or GROQ_API_KEY / GEMINI_API_KEY / CEREBRAS_API_KEY).");
    }

    let lastErr: unknown = null;
    let attempts = 0;
    for (const c of candidates) {
      const key = providerKey(c.provider);
      if (!key) continue;
      attempts++;
      try {
        const out = await callProvider(c, trimmed.messages, temperature, maxTokens, json, timeoutMs, key);
        const result: LlmResult = {
          text: out.text,
          provider: c.provider.id,
          model: c.model,
          cached: false,
          degraded,
          attempts,
          tokensIn: out.tokensIn || trimmed.tokens,
          tokensOut: out.tokensOut || estimateTokens(out.text),
          latencyMs: Date.now() - started,
        };
        if (cacheable && cacheKey) cachePut(cacheKey, task, result, cacheTtl);
        bumpUsage(opts.userId, result.tokensIn, result.tokensOut);
        recordEvent({ user_id: opts.userId ?? null, tag: opts.tag ?? null, task, provider: result.provider, model: result.model, ok: true, cached: false, degraded, attempts, tokens_in: result.tokensIn, tokens_out: result.tokensOut, latency_ms: result.latencyMs, trimmed: trimmed.trimmed });
        return result;
      } catch (e) {
        lastErr = e;
        // A 404/401 on a forced or pool model means "try the next candidate".
        continue;
      }
    }

    recordEvent({ user_id: opts.userId ?? null, tag: opts.tag ?? null, task, ok: false, degraded, attempts, tokens_in: trimmed.tokens, tokens_out: 0, latency_ms: Date.now() - started, error: lastErr instanceof Error ? lastErr.message.slice(0, 300) : "unknown" });
    throw lastErr instanceof AiError ? lastErr : new AiError(503, lastErr instanceof Error ? lastErr.message : "All AI models failed");
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
 * Back-compat shim: the signature every existing function already uses.
 * New code should call callLLM() and use the richer result.
 */
interface CallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  task?: LlmTask;
  cacheTtlSeconds?: number;
  userId?: string;
  tag?: string;
  personal?: boolean;
}

async function callOpenRouter(messages: ChatMessage[], opts: CallOptions = {}): Promise<string> {
  const result = await callLLM({
    messages,
    task: opts.task ?? (opts.json ? "json" : "chat"),
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    json: opts.json,
    model: opts.model,
    cacheTtlSeconds: opts.cacheTtlSeconds,
    userId: opts.userId,
    tag: opts.tag,
    personal: opts.personal,
  });
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
    if ((envGet("AI_REQUIRE_AUTH") ?? "true").toLowerCase() === "false") return { userId: null, supabase: await adminClient() };
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
// ── END GENERATED BLOCK ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await optionalUser(req);
    const { guess, answer } = await req.json().catch(() => ({ guess: "", answer: "" }));

    if (!guess || !answer) return jsonResponse({ match: false, type: "no_match" });

    const g = String(guess).trim().toLowerCase().slice(0, 80);
    const a = String(answer).trim().toLowerCase().slice(0, 80);

    if (!g || !a) return jsonResponse({ match: false, type: "no_match" });
    if (g === a) return jsonResponse({ match: true, type: "exact" });
    if (a.includes(g) && g.length >= Math.ceil(a.length * 0.6)) {
      return jsonResponse({ match: true, type: "partial" });
    }

    const raw = await callLLMText({
      task: "classify",
      tag: "guess-check",
      userId: userId ?? undefined,
      json: true,
      maxTokens: 40,
      messages: [
        {
          role: "system",
          content:
            "You are a judge in a drawing guessing game. The answer is a thing someone drew. Decide if the guess is close enough to accept.\n\n" +
            'Accept if: a synonym ("puppy" for "dog"), the same thing described differently ("ice cream cone" for "ice cream"), ' +
            'a very common alternative name ("bunny" for "rabbit"), singular/plural variants, or a minor spelling mistake.\n' +
            'Reject if: it is a different thing entirely, too vague ("animal" for "cat"), or a category instead of the specific thing.\n' +
            'Reply with ONLY JSON: {"match": true|false, "type": "synonym"|"close"|"no_match"}.',
        },
        {
          role: "user",
          content: `Answer: "${a}"\nGuess: "${g}"\n\nIs this close enough?`,
        },
      ],
    });

    const parsed = parseJsonLoose<{ match: boolean; type?: string }>(raw);
    if (!parsed || typeof parsed.match !== "boolean") return jsonResponse({ match: false, type: "no_match" });
    return jsonResponse({
      match: parsed.match,
      type: parsed.match ? (parsed.type ?? "close") : "no_match",
    });
  } catch (e) {
    // The game treats a missing answer as "not a match" and keeps playing.
    console.error("guess-check error:", e instanceof Error ? e.message : e);
    return jsonResponse({ match: false, type: "no_match" });
  }
});
