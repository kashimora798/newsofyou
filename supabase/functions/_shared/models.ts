/**
 * NewsOfYou — LLM provider + route configuration (Phase 0)
 * =========================================================
 * THIS IS THE ONLY FILE TO EDIT when a provider or a model id changes.
 * Everything else (`llm.ts`, every edge function) reads from here.
 *
 * ⚠️  Model ids and free-tier limits change often. Verify each id in the
 *     provider's current docs before trusting the defaults below, and prefer
 *     overriding them at runtime with the `LLM_ROUTES_JSON` secret instead of
 *     editing code:
 *
 *       supabase secrets set LLM_ROUTES_JSON='{"twin_chat":[{"provider":"groq","model":"llama-3.3-70b-versatile"}]}'
 *
 * Privacy tiers (plan §2.2, non-negotiable — see §7 of the build plan)
 * -------------------------------------------------------------------
 *  - "private"  anything containing real chat excerpts, memories or her
 *               messages. Routed ONLY to providers with `noTrain: true`
 *               (Groq, Cerebras, Cloudflare by default).
 *  - "low"      generic text with no personal data (game words, a daily
 *               question). Any configured provider may be used.
 *
 * `noTrain: true` is a *claim we must verify*: read the provider's current
 * data-use terms yourself before sending real chat text through it. Flip the
 * flag and the whole app follows.
 */

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

export type { ProviderId, ProviderDef, Route };
export { PROVIDERS, ROUTES, privateProviderIds, routesOverride };
