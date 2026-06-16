#!/usr/bin/env node
/**
 * audit-env.mjs — CI gate that cross-checks process.env.* usage against
 * the schema in src/config.ts and the documentation in .env.example.
 *
 * Run: node scripts/audit-env.mjs
 * Or:  npm run audit:env
 *
 * Exits 1 on any drift so it can fail CI.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_ROOT = resolve(__dirname, "..");
const SRC_DIR = join(SERVER_ROOT, "src");
const CONFIG_FILE = join(SRC_DIR, "config.ts");
const ENV_EXAMPLE = join(SERVER_ROOT, ".env.example");

const ENV_VAR_RE = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
const SCHEMA_KEY_RE = /^\s+([A-Z_][A-Z0-9_]*):\s*z\b/gm;
const ENV_EXAMPLE_KEY_RE = /^\s*#?\s*([A-Z_][A-Z0-9_]*)\s*=/gm;
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "__tests__"]);

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function color(c, s) {
  return process.stdout.isTTY ? `${c}${s}${RESET}` : s;
}

async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const s = await stat(p);
    if (s.isDirectory()) {
      yield* walk(p);
    } else if (/\.(ts|js|mjs|cjs)$/.test(entry)) {
      yield p;
    }
  }
}

async function readText(p) {
  return readFile(p, "utf8");
}

function extractKeys(content, regex) {
  const out = new Set();
  for (const m of content.matchAll(regex)) out.add(m[1]);
  return out;
}

async function main() {
  const configSrc = await readText(CONFIG_FILE);
  const envExampleSrc = await readText(ENV_EXAMPLE);

  const schemaKeys = extractKeys(configSrc, SCHEMA_KEY_RE);
  const documentedKeys = extractKeys(envExampleSrc, ENV_EXAMPLE_KEY_RE);

  const usedKeys = new Set();
  const usageByKey = new Map();

  for await (const file of walk(SRC_DIR)) {
    const src = await readText(file);
    const rel = relative(SERVER_ROOT, file);
    for (const m of src.matchAll(ENV_VAR_RE)) {
      const key = m[1];
      usedKeys.add(key);
      if (!usageByKey.has(key)) usageByKey.set(key, []);
      usageByKey.get(key).push(rel);
    }
  }

  const referencedButUndocumented = [...usedKeys]
    .filter((k) => !documentedKeys.has(k))
    .sort();
  const documentedButNotInSchema = [...documentedKeys]
    .filter((k) => !schemaKeys.has(k))
    .sort();
  const schemaButUndocumented = [...schemaKeys]
    .filter((k) => !documentedKeys.has(k))
    .sort();
  const schemaButUnused = [...schemaKeys]
    .filter((k) => !usedKeys.has(k))
    .sort();

  const errors = [];
  const warnings = [];
  const info = [];

  if (referencedButUndocumented.length) {
    errors.push({
      title: "process.env.* used in src/ but not documented in .env.example",
      items: referencedButUndocumented.map((k) => {
        const files = (usageByKey.get(k) || []).slice(0, 3).join(", ");
        return `  ${k}  ${DIM}(e.g. ${files})${RESET}`;
      }),
    });
  }

  if (documentedButNotInSchema.length) {
    warnings.push({
      title: "Documented in .env.example but missing from src/config.ts schema",
      items: documentedButNotInSchema.map((k) => `  ${k}`),
    });
  }

  if (schemaButUndocumented.length) {
    warnings.push({
      title: "In src/config.ts schema but not documented in .env.example",
      items: schemaButUndocumented.map((k) => `  ${k}`),
    });
  }

  if (schemaButUnused.length) {
    info.push({
      title: "In schema but never read via process.env.* (possibly config-driven only)",
      items: schemaButUnused.map((k) => `  ${k}`),
    });
  }

  const lines = [];
  lines.push("");
  lines.push(color(CYAN, "env audit report"));
  lines.push(color(DIM, `  schema:    ${schemaKeys.size} keys in src/config.ts`));
  lines.push(color(DIM, `  documented: ${documentedKeys.size} keys in .env.example`));
  lines.push(color(DIM, `  referenced: ${usedKeys.size} unique process.env.* in src/`));
  lines.push("");

  for (const w of warnings) {
    lines.push(color(YELLOW, `WARNING: ${w.title}`));
    lines.push(...w.items);
    lines.push("");
  }
  for (const i of info) {
    lines.push(color(DIM, `INFO: ${i.title}`));
    lines.push(...i.items);
    lines.push("");
  }
  for (const e of errors) {
    lines.push(color(RED, `ERROR: ${e.title}`));
    lines.push(...e.items);
    lines.push("");
  }

  if (errors.length === 0 && warnings.length === 0) {
    lines.push(color(CYAN, "OK — no drift detected."));
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("audit-env failed:", err);
  process.exit(2);
});
