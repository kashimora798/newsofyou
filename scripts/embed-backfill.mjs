#!/usr/bin/env node
/**
 * embed-backfill.mjs — drive the `embed-backfill` edge function until every
 * chat chunk and reply pair has a vector.
 *
 * One-time (and safe to re-run any time — it only touches rows where
 * `embedding is null`):
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/embed-backfill.mjs
 *
 * Prefer the service-role key over EMBED_SECRET: it is the same trust level the
 * function already runs with and needs no extra deployment secret. If you do
 * set `EMBED_SECRET` on the project, pass it as EMBED_SECRET here instead.
 *
 * Nothing is written to `messages`; only `chat_chunks.embedding` and
 * `reply_pairs.embedding` are filled in.
 */

const URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SECRET = process.env.EMBED_SECRET ?? "";
const BATCH_LIMIT = Number(process.env.EMBED_BATCH ?? 48);
const MAX_ROUNDS = Number(process.env.EMBED_MAX_ROUNDS ?? 400);

if (!URL) {
  console.error("SUPABASE_URL is required (e.g. https://xxxx.supabase.co)");
  process.exit(1);
}
if (!KEY && !SECRET) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY (preferred) or EMBED_SECRET.");
  process.exit(1);
}

const endpoint = `${URL}/functions/v1/embed-backfill`;
const headers = { "Content-Type": "application/json" };
if (KEY) headers.Authorization = `Bearer ${KEY}`;
if (SECRET) headers["x-embed-secret"] = SECRET;

let rounds = 0;
let total = 0;

for (;;) {
  rounds++;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ limit: BATCH_LIMIT }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`round ${rounds}: HTTP ${res.status} ${text.slice(0, 300)}`);
    process.exit(1);
  }

  const data = await res.json();
  const embedded = data.embedded ?? {};
  const remaining = data.remaining ?? {};
  const done = Object.values(embedded).reduce((n, v) => n + Number(v ?? 0), 0);
  total += done;

  console.log(
    `round ${rounds}: +${done} vectors (${Object.entries(embedded).map(([k, v]) => `${k}=${v}`).join(", ")}) | ` +
      `remaining ${Object.entries(remaining).map(([k, v]) => `${k}=${v}`).join(", ")}`,
  );

  if (data.failed) console.warn("  warnings:", data.failed);
  const left = Object.values(remaining).reduce((n, v) => n + Number(v ?? 0), 0);
  if (left === 0) {
    console.log(`\nDone — ${total} vectors written in ${rounds} round(s).`);
    break;
  }
  if (done === 0) {
    console.error(
      "\nNo progress in this round. Check that the embed-backfill function is deployed, " +
        "that Supabase.ai (gte-small) is available, and see the warnings above.",
    );
    process.exit(1);
  }
  if (rounds >= MAX_ROUNDS) {
    console.error(`\nStopped after ${MAX_ROUNDS} rounds — ${left} rows left. Re-run to continue.`);
    break;
  }

  await new Promise((r) => setTimeout(r, 300));
}
