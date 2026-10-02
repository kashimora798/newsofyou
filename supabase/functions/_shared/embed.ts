/**
 * NewsOfYou — free embeddings (Phase 1C)
 * ======================================
 * The plan's choice: Supabase's built-in `gte-small` model, which runs inside
 * Edge Functions at no cost. 384 dimensions, English-leaning (that is why the
 * search layer is hybrid: vectors + pg_trgm, merged with RRF).
 *
 * If a future switch to Cloudflare `bge-m3` (1024-dim) is ever wanted, change
 * `EMBED_DIM` + the column type and re-run the backfill — nothing else knows
 * the dimension (build-plan §2.3 #7).
 *
 * Generated copies: this file is inlined into the functions that use it via
 * `npm run inline:llm`. Import it directly from Edge Functions that ship with
 * a bundler.
 */

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/embed.ts) ──
// ── BEGIN INLINE: embed.ts ──
const EMBED_DIM = 384;

/** The gte-small session is created once per isolate and reused. */
const _embedState: { session: unknown; tried: boolean } = { session: null, tried: false };

function embedderAvailable(): boolean {
  const g = globalThis as { Supabase?: { ai?: { Session?: unknown } } };
  return Boolean(g.Supabase?.ai?.Session);
}

function embedSession(): { run(input: unknown, opts?: unknown): Promise<unknown> } | null {
  if (_embedState.tried) return _embedState.session as never;
  _embedState.tried = true;
  try {
    const g = globalThis as { Supabase?: { ai?: { Session?: new (model: string) => { run(input: unknown, opts?: unknown): Promise<unknown> } } } };
    const Session = g.Supabase?.ai?.Session;
    if (!Session) return null;
    _embedState.session = new Session("gte-small");
  } catch {
    _embedState.session = null;
  }
  return _embedState.session as never;
}

function asNumberArray(value: unknown): number[] | null {
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "number") {
    return (value as number[]).map((n) => Number(n));
  }
  // Some runtimes return Float32Array
  if (value && typeof (value as { length?: number }).length === "number" && !Array.isArray(value)) {
    try {
      return Array.from(value as ArrayLike<number>, (n) => Number(n));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Embed one or more strings with gte-small.
 * Throws when the runtime has no `Supabase.ai` (e.g. local Node): callers must
 * treat embeddings as best-effort and keep their non-vector path working.
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const clean = (texts ?? []).map((t) => String(t ?? "").slice(0, 2000));
  if (clean.length === 0) return [];

  const session = embedSession();
  if (!session) {
    throw new Error("Embeddings unavailable: Supabase.ai is not present in this runtime.");
  }

  const out: number[][] = [];
  for (const text of clean) {
    const raw = await session.run(text, { mean_pool: true, normalize: true });
    // `run` may return number[] or { data: number[] } depending on runtime.
    const vec = asNumberArray(raw) ?? asNumberArray((raw as { data?: unknown })?.data);
    if (!vec) throw new Error("Embedding model returned an unexpected shape.");
    out.push(vec.slice(0, EMBED_DIM));
  }
  return out;
}

/** Single-string convenience wrapper; returns null instead of throwing. */
async function embedText(text: string): Promise<number[] | null> {
  try {
    const [vec] = await embedTexts([text]);
    return vec ?? null;
  } catch (e) {
    console.error("embedText failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** pgvector literal for RPC calls: "[0.1,0.2,…]". */
function toPgVector(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? Number(n.toFixed(6)) : 0)).join(",")}]`;
}
// ── END INLINE: embed.ts ──
// ── END GENERATED BLOCK ──

export type { };
export { EMBED_DIM, embedText, embedTexts, embedderAvailable, toPgVector };
