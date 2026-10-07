#!/usr/bin/env node
/**
 * twin-nightly.mjs — run memory 2.0's sweep from your machine (Phase 5).
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/twin-nightly.mjs --days 7
 *
 * The same sweep the `twin-nightly` edge function runs: free heuristics pick the
 * lines worth keeping and the facts inside them, and at most ONE private model
 * call is spent on the top ~5% of a day's candidates.
 *
 * Safe to run twice: highlights dedupe on their text, facts on their lowercase
 * text, and `twin_nightly_state()` refuses a second sweep within 3 hours unless
 * you pass `--force` (the owner's key can force it).
 *
 * For a real nightly job, either schedule this script with cron, or point
 * `pg_cron` at the function:
 *
 *   select cron.schedule('twin-nightly', '30 2 * * *', $$
 *     select net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/twin-nightly',
 *       headers := jsonb_build_object('Authorization', 'Bearer <service-role>',
 *                                     'Content-Type', 'application/json'),
 *       body := jsonb_build_object('days', 7));
 *   $$);
 */

const URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1] ?? fallback;
};
const days = Number(flag("days", 7));
const force = args.includes("--force");

if (!URL) {
  console.error("SUPABASE_URL is required (e.g. https://xxxx.supabase.co)");
  process.exit(1);
}
if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required (this is a background job).");
  process.exit(1);
}

const res = await fetch(`${URL}/functions/v1/twin-nightly`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ days, force }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  process.exit(1);
}

let data = {};
try {
  data = JSON.parse(text);
} catch {
  console.error(`Unexpected response: ${text.slice(0, 400)}`);
  process.exit(1);
}

if (data.skipped) {
  console.log(`Skipped (${data.reason}) — last sweep was ${data.minutes_since ?? "?"} minutes ago. Use --force to override.`);
  process.exit(0);
}

console.log(`window          ${data.window?.from} → ${data.window?.to} (${data.days} days)`);
console.log(`lines kept      ${data.highlights}`);
console.log(`facts (free)    ${data.facts_heuristic}`);
console.log(`facts (model)   ${data.facts_llm} from ${data.llm_calls} call(s), ${data.tokens} tokens`);
console.log(`asked about     ${data.asked_about} line(s)`);
