#!/usr/bin/env node
/**
 * inline-llm.mjs — keep the inlined LLM router copies in sync.
 *
 * `supabase/functions/_shared/llm.ts` is the source of truth. Every AI edge
 * function in this repo must run standalone (it can be deployed by name and
 * pasted into the dashboard without a bundler), so the block between
 *
 *     // ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/llm.ts) ──
 *     // ── END GENERATED BLOCK ──
 *
 * is copied verbatim into each function that needs it.
 *
 * Usage:
 *   node scripts/inline-llm.mjs            # write the copies
 *   node scripts/inline-llm.mjs --check    # exit 1 when a copy is stale (CI)
 *   node scripts/inline-llm.mjs --list     # show which functions are managed
 *
 * Never hand-edit a generated block; edit _shared/llm.ts and re-run.
 *
 * Handles three shapes of target file:
 *   1. already has BEGIN/END markers      → replace the marked range
 *   2. legacy inlined block               → replace the legacy range
 *      (// ── Inlined shared helpers …  // ── end inlined helpers ──)
 *   3. no block yet but calls LLM helpers → insert before Deno.serve(/serve(
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");
const SOURCE = join(FUNCTIONS_DIR, "_shared", "llm.ts");

const BEGIN = "// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/llm.ts) ──";
const END = "// ── END GENERATED BLOCK ──";
const LEGACY_BEGIN = /^\/\/ ── Inlined shared helpers.*$/m;
const LEGACY_END = /^\/\/ ── end inlined helpers ──\s*$/m;

/** A function is managed when its own code (outside any block) uses the router. */
const TRIGGERS = [
  "callOpenRouter(",
  "callLLM(",
  "callLLMText(",
  "requirePartner(",
  "requireUser(",
  "optionalUser(",
  "jsonResponse(",
  "errorResponse(",
  "parseJsonLoose",
  "AiError",
];

function readSourceBlock() {
  const src = readFileSync(SOURCE, "utf8");
  const start = src.indexOf(BEGIN);
  const end = src.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find the generated block markers in ${SOURCE}`);
  }
  return src.slice(start, end + END.length) + "\n";
}

function listFunctions() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name)
    .filter((name) => existsSync(join(FUNCTIONS_DIR, name, "index.ts")));
}

function stripBlock(text) {
  const start = text.indexOf(BEGIN);
  if (start !== -1) {
    const end = text.indexOf(END);
    if (end !== -1) return text.slice(0, start) + text.slice(end + END.length);
  }
  const legacyBegin = text.match(LEGACY_BEGIN);
  if (legacyBegin && legacyBegin.index !== undefined) {
    const tail = text.slice(legacyBegin.index);
    const legacyEnd = tail.match(LEGACY_END);
    if (legacyEnd && legacyEnd.index !== undefined) {
      return text.slice(0, legacyBegin.index) + tail.slice(legacyEnd.index + legacyEnd[0].length);
    }
  }
  return text;
}

function isManaged(path) {
  const text = stripBlock(readFileSync(path, "utf8"));
  return TRIGGERS.some((t) => text.includes(t));
}

function applyBlock(path, block) {
  const original = readFileSync(path, "utf8");

  const beginIdx = original.indexOf(BEGIN);
  if (beginIdx !== -1) {
    const endIdx = original.indexOf(END, beginIdx);
    if (endIdx === -1) throw new Error(`${path}: BEGIN marker without END marker`);
    return original.slice(0, beginIdx) + block + original.slice(endIdx + END.length + 1);
  }

  const legacyBegin = original.match(LEGACY_BEGIN);
  if (legacyBegin && legacyBegin.index !== undefined) {
    const tail = original.slice(legacyBegin.index);
    const legacyEnd = tail.match(LEGACY_END);
    if (!legacyEnd || legacyEnd.index === undefined) throw new Error(`${path}: legacy block without end marker`);
    const after = tail.slice(legacyEnd.index + legacyEnd[0].length);
    return original.slice(0, legacyBegin.index) + block + after.replace(/^\n+/, "\n");
  }

  // No block yet: insert above the server entry point.
  const anchor = original.search(/^(Deno\.serve|serve)\(/m);
  if (anchor === -1) throw new Error(`${path}: could not find Deno.serve/serve to insert above`);
  const head = original.slice(0, anchor).replace(/\s*$/, "\n\n");
  const body = original.slice(anchor);
  return `${head}${block}\n${body}`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");
  const listOnly = args.has("--list");

  const block = readSourceBlock();
  const managed = listFunctions().filter((name) => isManaged(join(FUNCTIONS_DIR, name, "index.ts")));

  if (listOnly) {
    console.log(`Source: ${SOURCE}`);
    console.log(`Managed functions (${managed.length}):`);
    for (const name of managed) console.log(`  - ${name}`);
    for (const name of listFunctions().filter((n) => !managed.includes(n))) {
      console.log(`  (skipped, no LLM usage) ${name}`);
    }
    return;
  }

  const stale = [];
  for (const name of managed) {
    const path = join(FUNCTIONS_DIR, name, "index.ts");
    const next = applyBlock(path, block);
    const current = readFileSync(path, "utf8");
    if (next !== current) {
      stale.push(name);
      if (!check) writeFileSync(path, next);
    }
  }

  if (check && stale.length > 0) {
    console.error(`Stale inlined LLM block in ${stale.length} function(s):\n  ${stale.join("\n  ")}`);
    console.error("\nRun: npm run inline:llm");
    process.exit(1);
  }

  console.log(
    check
      ? `Inlined LLM block is up to date in all ${managed.length} managed function(s).`
      : `Updated ${stale.length} of ${managed.length} function(s)${stale.length ? `: ${stale.join(", ")}` : ""}.`,
  );
}

main();
