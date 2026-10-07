#!/usr/bin/env node
/**
 * inline-llm.mjs — keep the shared AI modules in sync with the edge functions.
 *
 * `supabase/functions/_shared/*.ts` are the sources of truth. Edge functions in
 * this repo deploy standalone (no bundler), so each one carries verbatim copies:
 *
 *   1. INLINE regions — a source file may embed another source's declarations
 *      between `// ── BEGIN INLINE: <file> ──` and `// ── END INLINE: <file> ──`.
 *      e.g. `_shared/llm.ts` embeds `_shared/models.ts`.
 *   2. GENERATED BLOCKS — the block between
 *      `// ── BEGIN GENERATED BLOCK (source: <path>) ──` and
 *      `// ── END GENERATED BLOCK ──` is copied into every function that uses it.
 *
 * Usage:
 *   node scripts/inline-llm.mjs            # sync everything (edit sources, run this)
 *   node scripts/inline-llm.mjs --check    # exit 1 when anything is stale (CI)
 *   node scripts/inline-llm.mjs --list     # show what is managed
 *
 * Never hand-edit a generated copy.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");
const SHARED_DIR = join(FUNCTIONS_DIR, "_shared");

/** Sources that can be embedded whole (INLINE regions) or distributed. */
const SOURCES = [
  {
    name: "models.ts",
    path: join(SHARED_DIR, "models.ts"),
    // functions that use these symbols should receive models.ts code
    triggers: ["PROVIDERS", "ROUTES", "privateProviderIds", "routesOverride"],
    distribute: false, // ships inside the llm.ts block instead
  },
  {
    name: "safety.ts",
    path: join(SHARED_DIR, "safety.ts"),
    triggers: [
      "TWIN_RULES",
      "buildTwinRules(",
      "quickGuard(",
      "safetyStop(",
      "GENTLE_FALLBACK_REPLY",
      "GUARD_TRIPPED_REPLY",
    ],
    distribute: true,
    defaultMaxTokens: 700,
  },
  {
    name: "embed.ts",
    path: join(SHARED_DIR, "embed.ts"),
    triggers: ["embedText(", "embedTexts(", "toPgVector(", "embedderAvailable("],
    distribute: true,
  },
  {
    name: "style.ts",
    path: join(SHARED_DIR, "style.ts"),
    triggers: ["computeStyleStats(", "buildStylePrompt(", "daypartOf("],
    distribute: true,
  },
  {
    name: "greet.ts",
    path: join(SHARED_DIR, "greet.ts"),
    triggers: ["pickMood(", "fillTemplate(", "daypartAt(", "staticGreeting(", "liveAllowed(", "GREETING_MOODS", "unknownPlaceholders("],
    distribute: true,
  },
  {
    name: "book.ts",
    path: join(SHARED_DIR, "book.ts"),
    triggers: [
      "composeHeuristicPage(",
      "buildBookPrompt(",
      "sanitizeWrittenPage(",
      "pickExcerpts(",
      "moodFromTone(",
      "BOOK_MOODS",
    ],
    distribute: true,
  },
  {
    name: "twinChat.ts",
    path: join(SHARED_DIR, "twinChat.ts"),
    triggers: [
      "buildTwinChatPrompt(",
      "buildTwinChatUser(",
      "parseTwinAnswer(",
      "decideAutoReply(",
      "guardTwinReply(",
      "toneHintFor(",
      "ALLOWED_ACTIONS",
    ],
    distribute: true,
  },
  {
    name: "llm.ts",
    path: join(SHARED_DIR, "llm.ts"),
    triggers: [
      "callOpenRouter(",
      "callLLM(",
      "callLLMText(",
      "requirePartner(",
      "requireUser(",
      "optionalUser(",
      "requireOwner(",
      "jsonResponse(",
      "errorResponse(",
      "parseJsonLoose",
      "redact(",
      "AiError",
      "AiUnavailable",
    ],
    distribute: true,
  },
];

const BEGIN_INLINE = (name) => `// ── BEGIN INLINE: ${name} ──`;
const END_INLINE = (name) => `// ── END INLINE: ${name} ──`;
const BEGIN_BLOCK = (source) => `// ── BEGIN GENERATED BLOCK (source: ${source}) ──`;
const END_BLOCK = "// ── END GENERATED BLOCK ──";

const rel = (p) => relative(ROOT, p).split("\\").join("/");

function readInlineRegion(source) {
  const text = readFileSync(source.path, "utf8");
  const begin = text.indexOf(BEGIN_INLINE(source.name));
  const end = text.indexOf(END_INLINE(source.name));
  if (begin === -1 || end === -1 || end < begin) return null;
  const from = begin + BEGIN_INLINE(source.name).length;
  return text.slice(from, end).replace(/^\n/, "").replace(/\n$/, "\n");
}

function readGeneratedBlock(source) {
  const text = readFileSync(source.path, "utf8");
  const begin = text.indexOf(BEGIN_BLOCK(rel(source.path)));
  if (begin === -1) return null;
  const end = text.indexOf(END_BLOCK, begin);
  if (end === -1) throw new Error(`${rel(source.path)}: BEGIN marker without END marker`);
  return text.slice(begin, end + END_BLOCK.length) + "\n";
}

function stripGeneratedBlock(text) {
  const marker = "// ── BEGIN GENERATED BLOCK (source: ";
  const begin = text.indexOf(marker);
  if (begin === -1) return text;
  const end = text.indexOf(END_BLOCK, begin);
  if (end === -1) return text;
  return text.slice(0, begin) + text.slice(end + END_BLOCK.length);
}

/** Every file that could carry a copy: shared modules + function entrypoints. */
function targetFiles() {
  const files = [];
  if (existsSync(SHARED_DIR)) {
    for (const f of readdirSync(SHARED_DIR)) {
      if (f.endsWith(".ts")) files.push(join(SHARED_DIR, f));
    }
  }
  for (const name of listFunctions()) files.push(join(FUNCTIONS_DIR, name, "index.ts"));
  return files;
}

function listFunctions() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name)
    .filter((name) => existsSync(join(FUNCTIONS_DIR, name, "index.ts")))
    .sort();
}

/** Step 1: embed source declarations into the INLINE regions of consumers. */
function syncInlineRegions(check) {
  const changed = [];
  for (const source of SOURCES) {
    const region = readInlineRegion(source);
    if (!region) continue;
    for (const file of targetFiles()) {
      if (file === source.path) continue;
      const text = readFileSync(file, "utf8");
      const begin = text.indexOf(BEGIN_INLINE(source.name));
      if (begin === -1) continue;
      const end = text.indexOf(END_INLINE(source.name), begin);
      if (end === -1) throw new Error(`${rel(file)}: BEGIN INLINE without END INLINE`);
      const from = begin + BEGIN_INLINE(source.name).length;
      const next = text.slice(0, from) + "\n" + region + text.slice(end);
      if (next !== text) {
        changed.push(rel(file));
        if (!check) writeFileSync(file, next);
      }
    }
  }
  return changed;
}

function isManaged(path, source) {
  const text = stripGeneratedBlock(readFileSync(path, "utf8"));
  if (text.indexOf(BEGIN_BLOCK(rel(source.path))) !== -1) return true;
  return source.triggers.some((t) => text.includes(t));
}

/** Step 2: copy GENERATED BLOCKS into every function that uses them. */
function distributeBlocks(check) {
  const changed = [];
  for (const source of SOURCES.filter((s) => s.distribute)) {
    const block = readGeneratedBlock(source);
    if (!block) continue;
    for (const name of listFunctions()) {
      const file = join(FUNCTIONS_DIR, name, "index.ts");
      const original = readFileSync(file, "utf8");
      if (!isManaged(file, source)) continue;

      const marker = BEGIN_BLOCK(rel(source.path));
      const begin = original.indexOf(marker);
      let next;
      if (begin !== -1) {
        const end = original.indexOf(END_BLOCK, begin);
        if (end === -1) throw new Error(`${rel(file)}: BEGIN marker without END marker`);
        next = original.slice(0, begin) + block + original.slice(end + END_BLOCK.length + 1);
      } else {
        const anchor = original.search(/^(Deno\.serve|serve)\(/m);
        if (anchor === -1) throw new Error(`${rel(file)}: could not find Deno.serve/serve to insert above`);
        const head = original.slice(0, anchor).replace(/\s*$/, "\n\n");
        next = `${head}${block}\n${original.slice(anchor)}`;
      }

      if (next !== original) {
        changed.push(`${name} (${source.name})`);
        if (!check) writeFileSync(file, next);
      }
    }
  }
  return changed;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");
  const listOnly = args.has("--list");

  if (listOnly) {
    for (const source of SOURCES) {
      const region = readInlineRegion(source);
      const block = readGeneratedBlock(source);
      console.log(`\n${rel(source.path)}`);
      console.log(`  inline region: ${region ? `${region.split("\n").length} lines` : "none"}`);
      console.log(`  generated block: ${block ? `${block.split("\n").length} lines` : "none"}${source.distribute ? "" : " (not distributed)"}`);
      if (source.distribute) {
        const users = listFunctions().filter((n) => isManaged(join(FUNCTIONS_DIR, n, "index.ts"), source));
        console.log(`  used by (${users.length}): ${users.join(", ") || "—"}`);
      }
    }
    const unused = listFunctions().filter(
      (n) => !SOURCES.some((s) => s.distribute && isManaged(join(FUNCTIONS_DIR, n, "index.ts"), s)),
    );
    console.log(`\nSkipped functions (no AI usage): ${unused.join(", ") || "—"}`);
    return;
  }

  const inlineChanged = syncInlineRegions(check);
  const distributed = distributeBlocks(check);
  const all = [...inlineChanged.map((f) => `${f} (inline region)`), ...distributed];

  if (check && all.length > 0) {
    console.error(`Stale inlined AI code in ${all.length} place(s):\n  ${all.join("\n  ")}`);
    console.error("\nRun: npm run inline:llm");
    process.exit(1);
  }

  console.log(
    check
      ? `Inlined AI code is up to date (${targetFiles().length} files checked).`
      : all.length === 0
        ? "Nothing to update — everything already in sync."
        : `Updated ${all.length} file(s):\n  ${all.join("\n  ")}`,
  );
}

main();
