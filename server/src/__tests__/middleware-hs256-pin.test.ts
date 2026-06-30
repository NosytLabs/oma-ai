/**
 * H1 — Regression test: Next.js middleware jwtVerify pins HS256 algorithm.
 *
 * Exploit (pre-fix): the Next.js middleware called
 *   await jwtVerify(session, secret, { issuer, audience })
 * without an `algorithms` allowlist. jose's default behavior is to accept
 * ANY algorithm supported by the key shape — including `none` for some
 * configurations. An attacker who knows the issuer/audience could forge
 * a token with `alg: none` and bypass the signature check.
 *
 * Fix: pin `algorithms: ['HS256']` so any non-HS256 token is rejected
 * before signature verification, AND add `clockTolerance: 5` to absorb
 * normal clock skew between the Hono server and the Next.js edge.
 *
 * This file is a "wiring" test: it does NOT spin up the Next.js
 * middleware (the middleware depends on NextRequest, which requires the
 * Next.js runtime). Instead, it asserts that the middleware source uses
 * the pinned algorithm and tolerance. A deeper integration test would
 * require Next.js dev-server boot, which is out of scope for vitest.
 *
 * If a future refactor accidentally drops the algorithm pin, this test
 * fails loudly and the security regression is caught at code-review time.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("H1 — Next.js middleware jwtVerify pins HS256 algorithm", () => {
  const middlewareSrc = readFileSync(
    resolve(__dirname, "../../../app/src/middleware.ts"),
    "utf8",
  );

  it("declares algorithms: ['HS256'] in jwtVerify options", () => {
    expect(middlewareSrc).toMatch(/algorithms:\s*\[\s*['"]HS256['"]\s*\]/);
  });

  it("declares clockTolerance (5s) to absorb edge clock skew", () => {
    expect(middlewareSrc).toMatch(/clockTolerance:\s*5\b/);
  });

  it("still sets issuer and audience on jwtVerify", () => {
    expect(middlewareSrc).toMatch(/issuer:\s*ISSUER/);
    expect(middlewareSrc).toMatch(/audience:\s*AUDIENCE/);
  });

  it("does NOT pass only `{ issuer, audience }` (the pre-fix shape)", () => {
    // Belt-and-suspenders: ensure the security-sensitive options are
    // present so a future "cleanup" can't silently strip them.
    const hasUnsafeShape = /jwtVerify\(\s*session,\s*secret,\s*\{\s*issuer:\s*ISSUER,\s*audience:\s*AUDIENCE\s*\}\s*\)/.test(
      middlewareSrc,
    );
    expect(hasUnsafeShape).toBe(false);
  });
});
