#!/usr/bin/env node
/**
 * check-sql.mjs — parse every migration with the real Postgres parser
 * (libpg_query via `pgsql-parser`), so a syntax error can never reach the
 * database.
 *
 *   npm run check:sql
 *
 * Requires the optional dev dependency:
 *   npm i -D pgsql-parser
 *
 * This only validates SYNTAX (it is not a database). Semantics — missing
 * functions, wrong column types, RLS behaviour — still need the SQL editor.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

let parse;
try {
  ({ parse } = await import("pgsql-parser"));
} catch {
  console.error("pgsql-parser is not installed. Run:  npm i -D pgsql-parser");
  process.exit(2);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const files = (only.length > 0 ? only : readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).map((f) => join(MIGRATIONS, f)))
  .sort();

let bad = 0;
for (const file of files) {
  const sql = readFileSync(file, "utf8");
  try {
    await parse(sql);
    console.log(`  ✓ ${file.split("/").pop()}`);
  } catch (e) {
    bad++;
    console.error(`  ✗ ${file.split("/").pop()}`);
    console.error("    " + String(e?.message ?? e).split("\n").slice(0, 8).join("\n    "));
  }
}

console.log(`\n${files.length - bad}/${files.length} migration file(s) parse cleanly`);
if (bad > 0) process.exit(1);
