import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Static check on the route registrations in server/src/index.ts.
// Reading the file (not importing) avoids the side-effect of booting
// the server (which would bind port 3001 and call process.exit).
//
// Reason this exists: a sibling subagent accidentally dropped
// app.route("/", openapiRoutes) and app.route("/", providersMetaRoutes)
// which silently broke /v1/openapi.json, /v1/openapi.yaml, /v1/docs,
// and /v1/providers/meta — all returning 404. A runtime regression
// test for every public route is overkill; a single grep on the
// bootstrap file catches future drops.

const INDEX_TS = resolve(import.meta.dirname, "../index.ts");

describe("app route registration", () => {
  const src = readFileSync(INDEX_TS, "utf8");

  const routes: ReadonlyArray<readonly [RegExp, string]> = [
    [/app\.route\(\s*"\/"\s*,\s*openapiRoutes\s*\)/, "/v1/openapi.json"],
    [/app\.route\(\s*"\/"\s*,\s*providersMetaRoutes\s*\)/, "/v1/providers/meta"],
    [/app\.route\(\s*"\/"\s*,\s*networkRoutes\s*\)/, "/v1/network"],
    [/app\.route\(\s*"\/"\s*,\s*adminObservabilityRoutes\s*\)/, "/v1/admin"],
    [/app\.route\(\s*"\/"\s*,\s*logRoutes\s*\)/, "/v1/log"],
  ];

  for (const [pattern, path] of routes) {
    it(`registers route for ${path}`, () => {
      expect(src, `missing ${pattern}`).toMatch(pattern);
    });
  }

  it("CORS allowlist in development includes http://127.0.0.1", () => {
    // Matches the dev-only branch that allows localhost OR 127.0.0.1.
    expect(src).toMatch(
      /config\.NODE_ENV\s*===\s*"development"[\s\S]*?127\.0\.0\.1/,
    );
  });

  it("does NOT have accidentally dropped routes", () => {
    // Regression guard: previous bug was that openapiRoutes +
    // providersMetaRoutes registrations were deleted entirely.
    // Count expected registrations to ensure none were silently dropped.
    const routeMatches = src.match(/app\.route\(\s*"\/"\s*,\s*\w+Routes\s*\)/g);
    expect(routeMatches).not.toBeNull();
    // OMA-AI's public app has at least 10 app.route(...) registrations.
    // If this drops below 10, a route was probably accidentally removed.
    expect(routeMatches!.length).toBeGreaterThanOrEqual(10);
  });

  it("does NOT have duplicate app.route registrations", () => {
    // Regression guard: previous bug was that openapiRoutes +
    // providersMetaRoutes were registered TWICE — first time by the
    // sibling subagent, then again by my "restoration" fix.
    // Hono tolerates duplicates but it doubles path-matching work
    // and confuses future maintainers about which line is canonical.
    const routeMatches = src.match(
      /app\.route\(\s*"\/"\s*,\s*(\w+Routes)\s*\)/g,
    ) ?? [];
    const counts = new Map<string, number>();
    for (const m of routeMatches) {
      const name = m.match(/,\s*(\w+Routes)/)![1];
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, n]) => n > 1);
    expect(
      duplicates,
      `duplicate registrations: ${duplicates.map(([k, v]) => `${k}x${v}`).join(", ")}`,
    ).toEqual([]);
  });
});
