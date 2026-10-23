import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = new Map();
for (const workspace of [".", "app", "server"]) {
  const manifestPath = path.join(root, workspace, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const requirePackage = createRequire(manifestPath);
  for (const section of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      let manifestFile;
      try { manifestFile = requirePackage.resolve(`${name}/package.json`); }
      catch { manifestFile = path.join(root, "node_modules", name, "package.json"); }
      const metadata = JSON.parse(readFileSync(manifestFile, "utf8"));
      const key = `${name}@${metadata.version}`;
      const item = packages.get(key) ?? { name, version: metadata.version, license: metadata.license ?? "See package license", dir: path.dirname(manifestFile), uses: new Set(), runtime: false };
      item.uses.add(workspace === "." ? "root tooling" : workspace);
      item.runtime ||= section === "dependencies";
      packages.set(key, item);
    }
  }
}
// Retain notices for these transitive packages already attributed by this repo.
for (const name of ["jose", "undici"]) {
  const file = path.join(root, "node_modules", name, "package.json");
  if (!existsSync(file)) continue;
  const metadata = JSON.parse(readFileSync(file, "utf8"));
  packages.set(`${name}@${metadata.version}`, { name, version: metadata.version, license: metadata.license, dir: path.dirname(file), uses: new Set(["transitive"]), runtime: true });
}
const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
const renderTable = items => ["| Package | Installed version | License declared by package | Used by |", "| --- | --- | --- | --- |", ...items.map(item => `| [${item.name}](https://www.npmjs.com/package/${item.name}) | ${item.version} | ${item.license} | ${[...item.uses].join(", ")} |`)].join("\n");
const publicPath = path.join(root, "app/public/licenses/third-party-notices.txt");
const upstreamSources = JSON.parse(readFileSync(path.join(root, "scripts/license-sources/sources.json"), "utf8"));
const notices = ["OMA third-party software notices", "", "The following license texts are copied from installed packages or the pinned upstream sources recorded in scripts/license-sources/sources.json. Original copyright and license terms are preserved.", ""];
for (const item of sorted.filter(item => item.runtime)) {
  const files = readdirSync(item.dir).filter(file => /^(licen[cs]e|notice)(\.[a-z]+)?$/i.test(file));
  notices.push(`===== ${item.name}@${item.version} (${item.license}) =====`, "");
  if (!files.length) {
    const source = path.join(root, "scripts/license-sources", `${item.name}@${item.version}.txt`);
    if (!existsSync(source)) throw new Error(`Missing license text for ${item.name}@${item.version}; review its upstream source before regenerating notices.`);
    notices.push(`Source: ${upstreamSources[`${item.name}@${item.version}`]}`, "", readFileSync(source, "utf8").trim(), "");
  }
  for (const file of files) notices.push(readFileSync(path.join(item.dir, file), "utf8").trim(), "");
}
mkdirSync(path.dirname(publicPath), { recursive: true });
writeFileSync(publicPath, notices.join("\n"));
const doc = ["# Third-party licenses", "", "This inventory is generated from the installed direct dependencies declared in the root, app and server package manifests. It also retains notices for installed jose and undici transitive dependencies. Package license declarations, original shipped license texts and pinned upstream license sources are the sources; transitive and bundled dependencies may have additional notices in their distributions.", "", "[Original runtime license texts](app/public/licenses/third-party-notices.txt) are also served by the website at `/licenses/third-party-notices.txt`.", "", "Regenerate after installing dependencies with `pnpm licenses:generate`.", "", "## Runtime dependencies", "", renderTable(sorted.filter(item => item.runtime)), "", "## Development tooling", "", renderTable(sorted.filter(item => !item.runtime)), "", "## Pinned upstream license sources", "", ...Object.entries(upstreamSources).map(([name, url]) => `- [${name}](${url})`), ""];
writeFileSync(path.join(root, "LICENSE-THIRD-PARTY.md"), doc.join("\n"));
console.log(`Wrote ${sorted.filter(item => item.runtime).length} runtime and ${sorted.filter(item => !item.runtime).length} tooling entries with original license texts.`);
