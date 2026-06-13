import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signTypedData = vi.fn().mockResolvedValue("0xsigned-payment");

vi.mock("../../config.js", () => ({
  config: {
    SURPLUS_WALLET_PRIVATE_KEY: "test-private-key",
    // P0 fix: the new x402 verifier is the settlement proxy on Base.
    SURPLUS_SETTLEMENT_CONTRACT: "0x0770d2124C0a581C28Cfc47a659817145e6Cc137",
    SURPLUS_PERMIT2_CONTRACT: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    SURPLUS_USDC_CONTRACT: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    SURPLUS_CHAIN_ID: 8453,
    SURPLUS_VERIFIER_CONTRACT: undefined,
    SURPLUS_MIN_DISCOUNT_PCT: 0,
    SURPLUS_DEFAULT_SCHEME: "upto",
  },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("viem", () => ({
  createWalletClient: vi.fn(() => ({ signTypedData })),
  http: vi.fn(),
}));

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({ address: "0x1234567890abcdef1234567890abcdef12345678" })),
}));

vi.mock("viem/chains", () => ({
  base: {},
}));

import { surplusChatCompletion } from "../surplus.js";

describe("Surplus Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("retries 402 responses with a signed PAYMENT-SIGNATURE envelope (upto scheme)", async () => {
    const paymentRequired = {
      x402Version: 1,
      accepts: [
        {
          scheme: "upto",
          network: "base",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          amount: "1000000",
          payTo: "0x1111111111111111111111111111111111111111",
          maxTimeoutSeconds: 300,
        },
      ],
      resource: {
        url: "https://www.surplusintelligence.ai/x402/api/inference/v1/chat/completions",
        description: "Surplus chat completion",
        mimeType: "application/json",
      },
    };

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "surplus-chat-1", choices: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const response = await surplusChatCompletion({
      model: "surplus/deepseek-r1",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(response.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    const [, retryInit] = vi.mocked(globalThis.fetch).mock.calls[1];
    const paymentSignatureHeader = (retryInit?.headers as Record<string, string>)["PAYMENT-SIGNATURE"];

    expect(paymentSignatureHeader).toBeDefined();
    expect(() => JSON.parse(paymentSignatureHeader)).not.toThrow();
    expect(JSON.parse(paymentSignatureHeader)).toMatchObject({
      signature: "0xsigned-payment",
      authorization: expect.any(String),
      payload: expect.objectContaining({
        payTo: "0x1111111111111111111111111111111111111111",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        network: "base",
        maxPayment: "1000000",
        selectedScheme: "upto",
      }),
    });
    expect(paymentSignatureHeader).not.toBe(Buffer.from(JSON.stringify(paymentRequired)).toString("base64"));
    expect(signTypedData).toHaveBeenCalledTimes(1);

    // P0 fix: verifyingContract must be the settlement proxy
    // (0x0770…c137), NOT the old recipient address 0x8581…c402.
    const signArgs = vi.mocked(signTypedData).mock.calls[0][0] as {
      domain: { verifyingContract: string; chainId: number; name: string; version: string };
      primaryType: string;
    };
    expect(signArgs.domain.verifyingContract).toBe(
      "0x0770d2124C0a581C28Cfc47a659817145e6Cc137"
    );
    expect(signArgs.domain.verifyingContract.toLowerCase()).not.toBe(
      "0x8581784d3e598cca3482375cff2409ac9dd8c402"
    );
    expect(signArgs.domain.chainId).toBe(8453);
    expect(signArgs.primaryType).toBe("Payment");
  });

  it("uses exact scheme when only exact is offered", async () => {
    const paymentRequired = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "base",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          amount: "2500000",
          payTo: "0x2222222222222222222222222222222222222222",
          maxTimeoutSeconds: 300,
        },
      ],
      resource: {
        url: "https://www.surplusintelligence.ai/x402/api/inference/v1/chat/completions",
        description: "Surplus chat completion",
        mimeType: "application/json",
      },
    };

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "surplus-chat-2", choices: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await surplusChatCompletion({
      model: "surplus/exact-model",
      messages: [{ role: "user", content: "hello" }],
    });

    const [, retryInit] = vi.mocked(globalThis.fetch).mock.calls[1];
    const paymentSignatureHeader = (retryInit?.headers as Record<string, string>)["PAYMENT-SIGNATURE"];
    const parsed = JSON.parse(paymentSignatureHeader!);
    expect(parsed.payload.selectedScheme).toBe("exact");
    expect(parsed.payload.payment).toBe("2500000");
    expect(parsed.payload.maxPayment).toBeUndefined();
    expect(parsed.payload.payTo).toBe("0x2222222222222222222222222222222222222222");
  });

  it("forwards X-Surplus-Min-Discount-Pct when minDiscountPct is provided", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ok", choices: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await surplusChatCompletion({
      model: "surplus/discount-test",
      messages: [{ role: "user", content: "hi" }],
      minDiscountPct: 25,
    });

    // The 200 path skips the x402 roundtrip; the probe should still
    // carry the discount header.
    const [, probeInit] = vi.mocked(globalThis.fetch).mock.calls[0];
    const probeHeaders = probeInit?.headers as Record<string, string>;
    expect(probeHeaders["X-Surplus-Min-Discount-Pct"]).toBe("25");
  });

  it("omits the min-discount header when minDiscountPct is 0", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ok", choices: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await surplusChatCompletion({
      model: "surplus/no-discount",
      messages: [{ role: "user", content: "hi" }],
    });

    const [, probeInit] = vi.mocked(globalThis.fetch).mock.calls[0];
    const probeHeaders = probeInit?.headers as Record<string, string>;
    expect(probeHeaders["X-Surplus-Min-Discount-Pct"]).toBeUndefined();
  });
});
