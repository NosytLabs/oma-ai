import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { clean } from "./clean.mjs";
import { isTransientPath } from "./repo-hygiene.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "oma-hygiene-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet", root]);
  return root;
}

function put(root, path, content = "fixture") {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

test("dry run leaves files intact; cleanup removes generated output and preserves local state", (t) => {
  const root = fixture(t);
  const generated = [
    "app/.next/cache/file", "server/dist/index.js", ".audit-session/screenshot.png",
    "artifacts/brand-kit/card.png", "app/playwright-report/index.html", ".tmp/run.json",
    "server/api.log", "app/debug.log.2.gz", "app/tsconfig.tsbuildinfo", ".eslintcache",
    "tmp/lighthouse/report.html", "app/public/screenshots-ux/home.png", "audit-session.md",
    "node_modules/.cache/compiler/output", "app/node_modules/.vite/results.json",
    "server/node_modules/.vite-temp/config.mjs",
  ];
  const preserved = [
    "README.md", "server/.env", "app/.env.local", ".vercel/project.json",
    "node_modules/package/index.js", ".pnpm-store/package", "data/account.json",
    "server/src/index.ts", "app/public/logos/logo.png", "tmp/keep.txt",
    "server/src/debug.log", "app/user-notes.md",
    "app/node_modules/package/index.js", "server/node_modules/package/index.js",
  ];
  for (const path of [...generated, ...preserved]) put(root, path);
  const options = { log() {} };
  const preview = clean(root, { ...options, dryRun: true });
  for (const path of [...generated, ...preserved]) assert.ok(existsSync(join(root, path)), path);
  const applied = clean(root, options);
  assert.deepEqual(applied.removed, preview.removed);
  for (const path of generated) assert.ok(!existsSync(join(root, path)), path);
  for (const path of preserved) assert.ok(existsSync(join(root, path)), path);
});

test("cleanup preserves database recovery backups while removing adjacent artifact reports", (t) => {
  const root = fixture(t);
  const backups = [".artifacts", "app/.artifacts", "server/.artifacts"].map((directory) => `${directory}/database-backups`);
  const reports = [".artifacts/provider-audit/report.json", "app/.artifacts/screenshot.png", "server/.artifacts/run.log"];
  for (const path of backups) put(root, `${path}/local.dump`, "recovery backup");
  for (const path of reports) put(root, path);
  const preview = clean(root, { dryRun: true, log() {} });
  for (const path of reports) assert.ok(existsSync(join(root, path)), path);
  const applied = clean(root, { log() {} });
  assert.deepEqual(applied.removed, preview.removed);
  assert.deepEqual(applied.skipped, backups);
  for (const path of backups) assert.ok(existsSync(join(root, path, "local.dump")), path);
  for (const path of reports) assert.ok(!existsSync(join(root, path)), path);
  assert.deepEqual(clean(root, { log() {} }).removed, []);
});

test("cleanup preserves tracked files and directories containing tracked content", (t) => {
  const root = fixture(t);
  for (const path of ["app/.cache/keep.json", "server/keep.log", "server/remove.log"]) put(root, path);
  execFileSync("git", ["-C", root, "add", "--", "app/.cache/keep.json", "server/keep.log"]);
  const { skipped } = clean(root, { log() {} });
  assert.deepEqual(skipped, ["app/.cache", "server/keep.log"]);
  assert.ok(existsSync(join(root, "app/.cache/keep.json")));
  assert.ok(existsSync(join(root, "server/keep.log")));
  assert.ok(!existsSync(join(root, "server/remove.log")));
});

test("cleanup never follows workspace or parent symlinks and only unlinks final symlinks", (t) => {
  const root = fixture(t);
  const outside = fixture(t);
  put(outside, ".next/keep.txt");
  put(outside, "lighthouse/keep.txt");
  put(outside, "keep.log");
  put(outside, ".vite/keep.json");
  symlinkSync(outside, join(root, "app"), "dir");
  symlinkSync(outside, join(root, "tmp"), "dir");
  symlinkSync(outside, join(root, ".cache"), "dir");
  symlinkSync(outside, join(root, "node_modules"), "dir");
  const { removed } = clean(root, { log() {} });
  assert.deepEqual(removed, [".cache"]);
  assert.ok(existsSync(join(root, "app")));
  assert.ok(existsSync(join(root, "tmp")));
  assert.ok(existsSync(join(root, "node_modules")));
  for (const path of [".next/keep.txt", "lighthouse/keep.txt", "keep.log", ".vite/keep.json"]) assert.ok(existsSync(join(outside, path)));
});

test("hygiene distinguishes scratch files from maintained docs, migrations and public assets", () => {
  for (const path of [
    ".audit-session/home.png", "artifacts/brand-kit/card.jpg", "server/api.log.1.gz",
    "app/public/screenshots-ux/home.png", "server/.env", "app/.env.local",
    "app/undefined/home.png", "tmp/lighthouse/report.json", "server/package-lock.json",
    "bun.lockb", "yarn.lock", "app/.next/types/routes.d.ts", "audit-notes.md",
    ".next", "app/.vercel", "node_modules",
  ]) assert.ok(isTransientPath(path), path);
  for (const path of [
    "docs/DEPLOYMENT.md", "app/AGENTS.md", "server/.env.example", "server/.env.prod.example",
    "pnpm-lock.yaml", "app/public/favicon.ico", "app/public/logos/logo.png",
    "app/public/licenses/third-party-notices.txt", "server/src/middleware/audit.ts",
    "server/src/db/migrations/meta/0002_snapshot.json",
  ]) assert.ok(!isTransientPath(path), path);
});

test("hygiene CLI rejects force-added ignored files, including paths with newlines", (t) => {
  const root = fixture(t);
  mkdirSync(join(root, "scripts"));
  for (const file of ["check-repo-hygiene.mjs", "repo-hygiene.mjs"]) {
    copyFileSync(new URL(file, import.meta.url), join(root, "scripts", file));
  }
  put(root, ".gitignore", "*.log\n.audit-*/\n");
  put(root, "server/api\nrun.log");
  put(root, ".audit-session/report.json");
  execFileSync("git", ["-C", root, "add", "--force", "--", "server/api\nrun.log", ".audit-session/report.json"]);
  const result = spawnSync(process.execPath, [join(root, "scripts/check-repo-hygiene.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Transient files must not be tracked/);
  assert.ok(result.stderr.includes("server/api\nrun.log"));
  assert.ok(result.stderr.includes(".audit-session/report.json"));
});
