#!/usr/bin/env node
/**
 * seed-greetings.mjs — fill the twin's greeting bank (~300 lines).
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   OWNER_ACCESS_TOKEN=eyJ... \
 *   node scripts/seed-greetings.mjs                 # all 9 moods, 3 per daypart
 *
 *   node scripts/seed-greetings.mjs --dry-run       # preview counts only
 *   node scripts/seed-greetings.mjs --replace       # re-seed (keeps hand-written lines)
 *   node scripts/seed-greetings.mjs --moods sweet,playful --per-daypart 4
 *
 * The token must belong to the twin owner (twin_config.owner_user_id). Get one
 * by signing in to the app and copying it from devtools, or run the same call
 * from the admin screen at /you/twin — this script is just the CLI convenience.
 */

const URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.OWNER_ACCESS_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN ?? "";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (!URL || !TOKEN) {
  console.error("SUPABASE_URL and OWNER_ACCESS_TOKEN are required.");
  process.exit(1);
}

const body = {
  moods: value("moods", "").split(",").map((s) => s.trim()).filter(Boolean),
  per_daypart: Number(value("per-daypart", 3)),
  dry_run: flag("dry-run"),
  replace: flag("replace"),
};
if (body.moods.length === 0) delete body.moods;

console.log(
  `Seeding greetings${body.replace ? " (replacing previous seed lines)" : ""}` +
    `${body.dry_run ? " — DRY RUN" : ""}: ${body.per_daypart} per daypart × ${body.moods?.length ?? 9} moods`,
);

const res = await fetch(`${URL}/functions/v1/seed-greetings`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("Unexpected response:", text.slice(0, 400));
  process.exit(1);
}

console.log(`\nInserted ${data.inserted}, duplicates skipped ${data.skipped}, blocked by guard ${data.guarded}`);
console.log("Per mood:", data.per_mood);
console.log("Model:", data.model, "| bank total:", data.total_in_bank ?? "n/a");
if (data.dry_run) console.log("\nDry run — nothing was written. Re-run without --dry-run.");
else console.log("\nReview them at /you/twin (delete the cringe ones — the picker only serves what is active).");
