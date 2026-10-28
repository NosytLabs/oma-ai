// Shared policy for local cleanup and the Git-index hygiene check.
export const workspaces = ["", "app", "server"];

const generatedDirectories = new Set([
  ".next", "dist", "coverage", ".turbo", ".cache", ".vite",
  ".nyc_output", ".docusaurus", "test-results", "playwright-report",
  ".playwright-mcp", ".tmp", ".artifacts", "artifacts",
  ".screenshots", "screenshots", "e2e_screenshots", "test-screenshots",
  "audit-screenshots", ".audit-screenshots", ".visual-audit",
]);

export function isGeneratedDirectory(name) {
  return generatedDirectories.has(name) ||
    /^\.audit(?:[-.]|$)/.test(name) ||
    /^audit-lh(?:[-.]|$)/.test(name) || /^lh-audit/.test(name);
}

export function isGeneratedFile(name) {
  return /(?:\.log(?:\.\d+)?(?:\.gz)?|\.tsbuildinfo)$/.test(name) ||
    [".eslintcache", ".DS_Store", "Thumbs.db"].includes(name);
}

export const extraGeneratedPaths = [
  "tmp/lighthouse", "app/tmp/lighthouse", "server/tmp/lighthouse",
  "app/public/screenshots-ux", "app/undefined",
];

export function isRootAuditFile(path) {
  return /^audit-[^/]+\.(?:md|png|jpe?g)$/.test(path);
}

export function isTransientPath(path) {
  const parts = path.split("/");
  const name = parts.at(-1);
  if (parts.some((part) => isGeneratedDirectory(part) ||
    ["node_modules", ".pnpm-store", ".vercel", ".opencode", ".vibedoctor", ".hermes", ".hallmark"].includes(part))) return true;
  if (extraGeneratedPaths.some((directory) => path === directory || path.startsWith(`${directory}/`))) return true;
  if (isGeneratedFile(name) || /(?:\.bak|\.backup|\.orig|\.swp|\.swo|\.old|~)$/.test(name)) return true;
  if (/^\.env(?:\.|$)/.test(name) && ![".env.example", ".env.prod.example"].includes(name)) return true;
  if (["package-lock.json", "npm-shrinkwrap.json", "bun.lock", "bun.lockb", "yarn.lock"].includes(name)) return true;
  if (path.startsWith("public/") || isRootAuditFile(path)) return true;
  // Product raster assets belong in the Next app's public directory. Elsewhere
  // these are ignored screenshots, including force-added browser audit output.
  return /\.(?:png|jpe?g|ico)$/i.test(name) && !path.startsWith("app/public/");
}
