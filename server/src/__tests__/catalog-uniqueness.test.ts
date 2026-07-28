import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "models.json");

describe("model catalog uniqueness + free OMA-AI models", () => {
  it("loads models.json with unique public ids across sections", () => {
    const raw = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as Record<
      string,
      Record<string, { id?: string; provider?: string; gonkaId?: string }>
    >;
    const ids: string[] = [];
    const gonka: string[] = [];
    for (const section of Object.values(raw)) {
      if (!section || typeof section !== "object") continue;
      for (const [key, def] of Object.entries(section)) {
        const id = def?.id ?? key;
        ids.push(id);
        if (def?.provider === "gonka" || def?.gonkaId) {
          gonka.push(id);
        }
      }
    }
    expect(ids.length).toBeGreaterThan(50);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups, `duplicate model ids: ${dups.join(", ")}`).toEqual([]);
    // Free website chat depends on at least one gonka model
    expect(gonka.length).toBeGreaterThanOrEqual(1);
    expect(gonka).toEqual(expect.arrayContaining(["minimax-m2.7"]));
  });
});
