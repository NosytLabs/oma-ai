import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--dry-run")) {
  console.error("Usage: pnpm clean [--dry-run]");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = args.includes("--dry-run");
// Only generated paths inside this checkout. Keep dependencies, environment
// files, Vercel project linkage, source assets and local data intact.
const directories = [
  ".next", "dist", "coverage", ".turbo", ".cache", ".vite",
  ".nyc_output", "test-results", "playwright-report",
];
const paths = [
  ...["", "app", "server"].flatMap((workspace) =>
    directories.map((directory) => join(workspace, directory))),
  "app/tsconfig.tsbuildinfo",
  "server/tsconfig.tsbuildinfo",
];

let count = 0;
for (const relativePath of paths) {
  const target = join(root, relativePath);
  if (!existsSync(target)) continue;
  if (!dryRun) rmSync(target, { recursive: true, force: true });
  console.log(`${dryRun ? "Would remove" : "Removed"}: ${relativePath}`);
  count++;
}
console.log(`${dryRun ? "Found" : "Removed"} ${count} generated paths.`);
