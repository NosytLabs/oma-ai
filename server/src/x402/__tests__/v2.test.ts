/**
 * x402 V2 wire-format tests. Verifies that:
 *  - V2 402 response carries base64 PAYMENT-REQUIRED header
 *  - Decoded header matches canonical V2 PaymentRequired shape
 *  - PAYMENT-SIGNATURE parsing accepts base64 JSON and validates x402Version
 *  - Protocol-level validation returns 501 until EIP-3009 settlement ships
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    TREASURY_BASE_ADDRESS: "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402",
    HOUDINI_ADDRESS_TO: "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402",
    FACILITATOR_MODE: "mock",
  },
}));

vi.mock("../../middleware/rate-limit.js", () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(),
  },
}));

import { Hono } from "hono";
import { x402V2Routes, encodeV2PaymentRequired, encodeV2PaymentPayload } from "../v2.js";

const app = new Hono();
app.route("/", x402V2Routes);

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

describe("x402 V2 wire format", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /v2/x402/pay-req-test returns 402 with base64 PAYMENT-REQUIRED header", async () => {
    const res = await app.request("/v2/x402/pay-req-test", { method: "POST" });
    expect(res.status).toBe(402);

    const headerVal = res.headers.get("PAYMENT-REQUIRED");
    expect(headerVal).toBeTruthy();

    const decoded = JSON.parse(Buffer.from(headerVal!, "base64").toString("utf8"));
    expect(decoded.x402Version).toBe(2);
    expect(Array.isArray(decoded.accepts)).toBe(true);
    expect(decoded.accepts[0].scheme).toBe("exact");
    expect(decoded.accepts[0].network).toBe("eip155:8453");
    expect(decoded.accepts[0].payTo.toLowerCase()).toBe("0x8581784d3e598cca3482375cff2409ac9dd8c402");
    expect(decoded.accepts[0].maxTimeoutSeconds).toBe(300);
    expect(decoded.accepts[0].asset.toLowerCase()).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  });

  it("PAYMENT-REQUIRED header is base64 (round-trips)", async () => {
    const headerVal = (await app.request("/v2/x402/pay-req-test", { method: "POST" })).headers.get("PAYMENT-REQUIRED")!;
    // base64 should be valid and decodable
    const decoded = Buffer.from(headerVal, "base64").toString("utf8");
    expect(() => JSON.parse(decoded)).not.toThrow();
  });

  it("REJECTS missing PAYMENT-SIGNATURE → 400", async () => {
    const res = await app.request("/v2/x402/verify", { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { type: string } };
    expect(body.error.type).toBe("payment_error");
  });

  it("REJECTS malformed base64 → 400", async () => {
    const res = await app.request("/v2/x402/verify", {
      method: "POST",
      headers: { "PAYMENT-SIGNATURE": "not-base64-or-not-json!!!" },
    });
    expect(res.status).toBe(400);
  });

  it("REJECTS wrong x402Version → 400", async () => {
    const payload = { x402Version: 1, scheme: "exact", network: "eip155:8453", payload: {}, resource: "/test" };
    const res = await app.request("/v2/x402/verify", {
      method: "POST",
      headers: { "PAYMENT-SIGNATURE": b64(JSON.stringify(payload)) },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/x402Version/i);
  });

  it("REJECTS unsupported scheme → 400", async () => {
    const payload = { x402Version: 2, scheme: "upto", network: "eip155:8453", payload: {}, resource: "/test" };
    const res = await app.request("/v2/x402/verify", {
      method: "POST",
      headers: { "PAYMENT-SIGNATURE": b64(JSON.stringify(payload)) },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/scheme/i);
  });

  it("ACCEPTS well-formed V2 payload → 501 (settlement pending)", async () => {
    const payload = {
      x402Version: 2,
      scheme: "exact",
      network: "eip155:8453",
      payload: { from: "0xabc", to: "0xdef", value: "1000000", validAfter: "0", validBefore: "9999999999", nonce: "0x00" },
      resource: "/v2/x402/pay-req-test",
    };
    const res = await app.request("/v2/x402/verify", {
      method: "POST",
      headers: { "PAYMENT-SIGNATURE": b64(JSON.stringify(payload)) },
    });
    expect(res.status).toBe(501);
    const body = await res.json() as { error: { type: string; code: string } };
    expect(body.error.type).toBe("not_implemented");
    expect(body.error.code).toBe("x402_v2_settlement_pending");
  });

  it("settle endpoint returns 501 with same code", async () => {
    const res = await app.request("/v2/x402/settle", { method: "POST" });
    expect(res.status).toBe(501);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("x402_v2_settlement_pending");
  });
});

describe("V2 encode helpers", () => {
  it("encodeV2PaymentRequired → base64 string of JSON", () => {
    const required = {
      x402Version: 2 as const,
      accepts: [{
        scheme: "exact" as const,
        network: "eip155:8453" as const,
        maxAmountRequired: "0.10",
        resource: "/test",
        payTo: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        maxTimeoutSeconds: 60,
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      }],
    };
    const out = encodeV2PaymentRequired(required);
    expect(typeof out).toBe("string");
    const decoded = JSON.parse(Buffer.from(out, "base64").toString("utf8"));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts[0].maxAmountRequired).toBe("0.10");
  });

  it("encodeV2PaymentPayload round-trips", () => {
    const payload = { x402Version: 2 as const, scheme: "exact" as const, network: "eip155:8453" as const, payload: { foo: "bar" }, resource: "/x" };
    const out = encodeV2PaymentPayload(payload);
    const decoded = JSON.parse(Buffer.from(out, "base64").toString("utf8"));
    expect(decoded.payload.foo).toBe("bar");
  });
});
