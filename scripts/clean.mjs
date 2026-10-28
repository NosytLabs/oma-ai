import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extraGeneratedPaths, isGeneratedDirectory, isGeneratedFile, isRootAuditFile, workspaces } from "./repo-hygiene.mjs";

function stat(path) {
  try { return lstatSync(path); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// A final symlink is safe to unlink, but never traverse one to delete its target.
function hasRealParents(root, relativePath) {
  const parts = relativePath.split("/");
  for (let index = 1; index < parts.length; index++) {
    const parent = stat(join(root, ...parts.slice(0, index)));
    if (!parent?.isDirectory() || parent.isSymbolicLink()) return false;
  }
  return true;
}

export function clean(root, { dryRun = false, log = console.log } = {}) {
  const git = spawnSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" });
  if (git.error || git.status !== 0) throw new Error("Cleanup requires a readable Git checkout so tracked content can be preserved.");
  const tracked = git.stdout.split("\0").filter(Boolean);
  const candidates = new Set(extraGeneratedPaths);

  // Scan only workspace roots, never source, dependencies or local data.
  for (const workspace of workspaces) {
    const directory = join(root, workspace);
    if (!stat(directory)?.isDirectory()) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (isGeneratedDirectory(entry.name) ||
        (!entry.isDirectory() && (isGeneratedFile(entry.name) || (!workspace && isRootAuditFile(entry.name))))) {
        candidates.add(workspace ? `${workspace}/${entry.name}` : entry.name);
      }
    }
  }

  const removed = [];
  const skipped = [];
  for (const relativePath of [...candidates].sort()) {
    if (!hasRealParents(root, relativePath) || !stat(join(root, relativePath))) continue;
    if (tracked.some((path) => path === relativePath || path.startsWith(`${relativePath}/`))) {
      skipped.push(relativePath);
      log(`Skipped tracked content: ${relativePath}`);
      continue;
    }
    if (!dryRun) rmSync(join(root, relativePath), { recursive: true, force: true });
    log(`${dryRun ? "Would remove" : "Removed"}: ${relativePath}`);
    removed.push(relativePath);
  }
  log(`${dryRun ? "Found" : "Removed"} ${removed.length} generated paths.`);
  return { removed, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run")) {
    console.error("Usage: pnpm clean [--dry-run]");
    process.exit(1);
  }
  try {
    clean(fileURLToPath(new URL("..", import.meta.url)), { dryRun: args.includes("--dry-run") });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
