import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signTypedData = vi.fn().mockResolvedValue("0xsigned-payment");

vi.mock("../../config.js", () => ({
  config: {
    SURPLUS_WALLET_PRIVATE_KEY: "test-private-key",
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

  it("retries 402 responses with a signed PAYMENT-SIGNATURE envelope", async () => {
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
  });
});
