import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isTransientPath } from "./repo-hygiene.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
// Inspect the index so even force-added ignored files are rejected.
const result = spawnSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" });
if (result.error || result.status !== 0) {
  console.error("Unable to inspect tracked files:", result.error?.message || result.stderr.trim());
  process.exit(1);
}
const transient = result.stdout.split("\0").filter((path) => path && isTransientPath(path));
if (transient.length) {
  console.error(`Transient files must not be tracked:\n${transient.map((path) => `  ${path}`).join("\n")}`);
  process.exit(1);
}
console.log("Repository hygiene: no tracked transient files.");
