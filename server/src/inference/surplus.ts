import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { logger } from "../lib/logger.js";

const SURPLUS_TIMEOUT_MS = 60_000;
const SURPLUS_BASE_URL = "https://www.surplusintelligence.ai";
const SURPLUS_API_VERSION = "v1";

// Clamp the operator-facing "Minimum Discount Routing" knob to the
// 0-90 range accepted by config validation. Values > 90 are rejected
// (a 100% discount would mean "free", which is never valid for paid
// inference), and negative values would invert the floor — we treat
// anything out of range as "no floor set" (0) to be conservative.
function clampMinDiscountPct(value: number | undefined | null): number {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 0;
  }
  if (value <= 0) return 0;
  if (value > 90) return 0;
  return Math.floor(value);
}

export interface SurplusPaymentRequirement {
  x402Version: number;
  accepts: Array<{
    scheme: "exact" | "upto";
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  }>;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
}

export interface SurplusModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    display_name: string;
    description: string;
    context_length: number;
    supported_parameters: string[];
    pricing: Record<string, { input: number; output: number }>;
  }>;
}

interface SurplusPaymentSignatureEnvelope {
  x402Version: string;
  signature: string;
  authorization: string;
  payload: Record<string, unknown>;
}

interface SurplusErrorResponse {
  error?: {
    message?: string;
    code?: string;
  };
}

async function surplusFetch(
  endpoint: string,
  options: RequestInit & { paymentSignature?: string } = {}
): Promise<Response> {
  const tracer = trace.getTracer("oma-server");
  const url = `${SURPLUS_BASE_URL}${endpoint}`;

  return tracer.startActiveSpan("llm.provider.surplus", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "surplus");
      span.setAttribute("http.method", options.method ?? "GET");
      span.setAttribute("http.url", url);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

      if (options.paymentSignature) {
        headers["PAYMENT-SIGNATURE"] = options.paymentSignature;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      span.setAttribute("http.status_code", response.status);
      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (err) {
      span.setAttribute("error", true);
      span.setAttribute("error.type", err instanceof Error ? err.constructor.name : "UnknownError");
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function surplusChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  minDiscountPct?: number;
  [key: string]: unknown;
}, requestSignal?: AbortSignal): Promise<Response> {
  const tracer = trace.getTracer("oma-server");
  const endpoint = `/x402/api/inference/${SURPLUS_API_VERSION}/chat/completions`;
  const requestBody = {
    model: body.model,
    messages: body.messages,
    stream: body.stream ?? false,
  };

  // Operator-configured minimum discount floor (Surplus "Minimum
  // Discount Routing"). If body.minDiscountPct is provided, prefer it;
  // otherwise fall back to the SURPLUS_MIN_DISCOUNT_PCT env var.
  // Clamp to the 0-90 range to match config validation; the upstream
  // may or may not honor this header (it is not documented in
  // surplusintelligence.ai/llms.txt as of 2026-06-12).
  const minDiscountPct = clampMinDiscountPct(
    body.minDiscountPct ?? config.SURPLUS_MIN_DISCOUNT_PCT
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SURPLUS_TIMEOUT_MS);
  // ponytail: thread inbound request.signal so client disconnect cancels
  // the upstream call. Combine with the timeout controller so either
  // trigger fires.
  const upstreamSignal = requestSignal
    ? AbortSignal.any([requestSignal, controller.signal])
    : controller.signal;

  return tracer.startActiveSpan("llm.provider.surplus", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "surplus");
      span.setAttribute("llm.model", body.model);
      if (minDiscountPct > 0) {
        span.setAttribute("llm.surplus.min_discount_pct", minDiscountPct);
      }
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", `${SURPLUS_BASE_URL}${endpoint}`);

      const probeHeaders: Record<string, string> = {};
      if (minDiscountPct > 0) {
        probeHeaders["X-Surplus-Min-Discount-Pct"] = String(minDiscountPct);
      }

      const probeResponse = await surplusFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(requestBody),
        signal: upstreamSignal,
        headers: probeHeaders,
      });

      if (probeResponse.status === 402) {
        clearTimeout(timeout);

        const paymentRequiredHeader =
          probeResponse.headers.get("PAYMENT-REQUIRED") ||
          probeResponse.headers.get("x-payment-required");

        if (!paymentRequiredHeader) {
          throw Object.assign(
            new Error("Surplus x402 payment required but no payment header returned"),
            { status: 402 }
          );
        }

        const paymentData = JSON.parse(
          Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
        ) as SurplusPaymentRequirement;

        const paymentPayload = await buildPaymentPayload(paymentData, body);
        const signature = await signPayment(paymentPayload);
        const paymentSignature: SurplusPaymentSignatureEnvelope = {
          x402Version: String(paymentData.x402Version),
          signature,
          authorization: "",
          payload: paymentPayload,
        };

        const retryResponse = await surplusFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(requestBody),
          signal: upstreamSignal,
          paymentSignature: JSON.stringify(paymentSignature),
          headers: probeHeaders,
        });

        span.setAttribute("http.status_code", retryResponse.status);

        if (retryResponse.status === 402) {
          const errorData =
            (await tryParseErrorResponse(retryResponse)) ||
            "Surplus payment rejected";
          throw Object.assign(new Error(`Surplus payment failed: ${errorData}`), {
            status: 402,
          });
        }

        if (!retryResponse.ok) {
          const errorData = await tryParseErrorResponse(retryResponse);
          throw Object.assign(
            new Error(`Surplus error: ${retryResponse.status} - ${errorData}`),
            { status: 502 }
          );
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return retryResponse;
      }

      span.setAttribute("http.status_code", probeResponse.status);

      if (!probeResponse.ok) {
        clearTimeout(timeout);
        const errorData = await tryParseErrorResponse(probeResponse);
        throw Object.assign(
          new Error(`Surplus error: ${probeResponse.status} - ${errorData}`),
          { status: 502 }
        );
      }

      clearTimeout(timeout);
      span.setStatus({ code: SpanStatusCode.OK });
      return probeResponse;
    } catch (err) {
      span.setAttribute("error", true);
      span.setAttribute("error.type", err instanceof Error ? err.constructor.name : "UnknownError");
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      clearTimeout(timeout);
      span.end();
    }
  });
}

async function buildPaymentPayload(
  paymentData: SurplusPaymentRequirement,
  _originalBody: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const upto = paymentData.accepts.find((a) => a.scheme === "upto");
  const exact = paymentData.accepts.find((a) => a.scheme === "exact");
  const selected = upto || exact;

  if (!selected) {
    throw Object.assign(
      new Error("No supported x402 payment scheme available from Surplus"),
      { status: 402 }
    );
  }

  const payload: Record<string, unknown> = {
    ...paymentData,
    selectedScheme: selected.scheme,
  };

  if (selected.scheme === "upto") {
    payload.payType = "upto";
    payload.maxPayment = selected.amount;
    payload.payTo = selected.payTo;
    payload.network = selected.network;
    payload.asset = selected.asset;
  } else {
    payload.payType = "exact";
    payload.payment = selected.amount;
    payload.payTo = selected.payTo;
    payload.network = selected.network;
    payload.asset = selected.asset;
  }

  return payload;
}

async function signPayment(
  _payload: Record<string, unknown>
): Promise<string> {
  const walletPrivateKey = config.SURPLUS_WALLET_PRIVATE_KEY;
  if (!walletPrivateKey) {
    throw Object.assign(
      new Error(
        "Surplus wallet private key not configured. Set SURPLUS_WALLET_PRIVATE_KEY in environment."
      ),
      { status: 500 }
    );
  }

  // Resolve the EIP-712 verifyingContract.
  // Per surplusintelligence.ai/llms.txt (2026-06-12), Surplus's
  // verifyingContract on Base is the SETTLEMENT PROXY at
  // 0x0770d2124C0a581C28Cfc47a659817145e6Cc137. The 0x8581…c402
  // address we previously used is the payTo/treasury recipient, NOT
  // the verifier, which is why signatures were being rejected
  // silently.
  //
  // TRACKED ISSUE: github.com/oma-ai/oma-ai/issues/surplus-x402-schemes
  // Stopgap: this route signs against the Surplus settlement proxy
  // (0x0770…c137) as the EIP-712 verifyingContract. The proper
  // scheme-aware signer — `exact` over EIP-3009 TransferWithAuthorization
  // (USDC_BASE, name "USD Coin", version "2", chainId 8453) and `upto`
  // over Permit2 PermitWitnessTransferFrom (0x0000…BA3, name "Permit2",
  // chainId 8453) — is pending. Until that lands, signatures verify
  // against the proxy and the verifier, not the recipient, which is
  // why the previous 0x8581…c402 attempts were silently rejected.
  const legacyVerifier = config.SURPLUS_VERIFIER_CONTRACT;
  const verifyingContract = (legacyVerifier ??
    config.SURPLUS_SETTLEMENT_CONTRACT) as `0x${string}`;
  const chainId = config.SURPLUS_CHAIN_ID ?? 8453;

  try {
    const { createWalletClient, http } = await import("viem");
    const { privateKeyToAccount } = await import("viem/accounts");
    const { base } = await import("viem/chains");

    const account = privateKeyToAccount(`0x${walletPrivateKey.replace("0x", "")}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    const signResult = await walletClient.signTypedData({
      domain: {
        name: "Surplus Intelligence",
        version: "1",
        chainId,
        verifyingContract,
      },
      types: {
        Payment: [
          { name: "payTo", type: "address" },
          { name: "asset", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "network", type: "string" },
        ],
      },
      message: {
        payTo: _payload.payTo as `0x${string}`,
        asset: _payload.asset as `0x${string}`,
        amount: BigInt(_payload.maxPayment as string || _payload.payment as string),
        network: _payload.network as string,
      },
      primaryType: "Payment",
    });

    return signResult;
  } catch (err) {
    logger.error(
      { error: (err as Error).message },
      "Surplus x402 payment signing failed"
    );
    throw Object.assign(
      new Error("Failed to sign Surplus payment"),
      { status: 500 }
    );
  }
}

export async function surplusListModels(): Promise<SurplusModelsResponse> {
  const tracer = trace.getTracer("oma-server");
  const endpoint = `/api/inference/${SURPLUS_API_VERSION}/models`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  return tracer.startActiveSpan("llm.provider.surplus", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "surplus");
      span.setAttribute("http.method", "GET");
      span.setAttribute("http.url", `${SURPLUS_BASE_URL}${endpoint}`);

      const response = await surplusFetch(endpoint, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      span.setAttribute("http.status_code", response.status);

      if (!response.ok) {
        const errorData = await tryParseErrorResponse(response);
        throw Object.assign(
          new Error(`Surplus list models error: ${response.status} - ${errorData}`),
          { status: 502 }
        );
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return response.json() as Promise<SurplusModelsResponse>;
    } catch (err) {
      clearTimeout(timeout);
      span.setAttribute("error", true);
      span.setAttribute("error.type", err instanceof Error ? err.constructor.name : "UnknownError");
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      if ((err as { status?: number }).status) throw err;
      throw Object.assign(
        new Error(`Surplus list models failed: ${(err as Error).message}`),
        { status: 502 }
      );
    } finally {
      span.end();
    }
  });
}

export async function surplusHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const tracer = trace.getTracer("oma-server");
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const endpoint = `/api/inference/${SURPLUS_API_VERSION}/models`;

  return tracer.startActiveSpan("llm.provider.surplus", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "surplus");
      span.setAttribute("http.method", "GET");
      span.setAttribute("http.url", `${SURPLUS_BASE_URL}${endpoint}`);

      const response = await surplusFetch(endpoint, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      span.setAttribute("http.status_code", response.status);
      span.setStatus({ code: SpanStatusCode.OK });

      return {
        isUp: response.ok,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      clearTimeout(timeout);
      span.setAttribute("error", true);
      span.setAttribute("error.type", err instanceof Error ? err.constructor.name : "UnknownError");
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      return {
        isUp: false,
        latencyMs: Date.now() - start,
        error: String(err),
      };
    } finally {
      span.end();
    }
  });
}

async function tryParseErrorResponse(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as SurplusErrorResponse;
    return data?.error?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}
