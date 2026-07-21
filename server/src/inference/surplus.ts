import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { randomBytes } from "node:crypto";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { logger } from "../lib/logger.js";

const SURPLUS_TIMEOUT_MS = 60_000;
const SURPLUS_BASE_URL = "https://api.surplusintelligence.ai";

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
  const endpoint = `/v1/chat/completions`;
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

        // Strip internal signing fields (BigInt) before JSON serialization.
        // Surplus only needs the payment fields, not the raw witness/permit objects.
        const payloadJson = serializePayloadForJson(paymentPayload);

        const paymentSignature: SurplusPaymentSignatureEnvelope = {
          x402Version: String(paymentData.x402Version),
          signature,
          authorization: "",
          payload: payloadJson,
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

// ---------------------------------------------------------------------------
// Scheme-aware EIP-712 payload types
// ---------------------------------------------------------------------------
//
// Surplus accepts two x402 schemes on Base:
//
//  `upto`  — Permit2 witness pattern (USDC approve + permitWitnessTransferFrom).
//             Signs a PermitWitnessTransferFrom typed data with the Surplus
//             Payment as the witness. Verifying contract = Permit2
//             (0x0000…BA3 on Base).
//
//  `exact` — EIP-3009 transferWithAuthorization.
//             Signs a TransferWithAuthorization typed data with the USDC
//             FiatTokenV2_2 domain. Verifying contract = USDC
//             (0x8335…2913 on Base).

interface SurplusPaymentWitness {
  payTo: string;
  asset: string;
  amount: string;
  network: string;
  resource: SurplusPaymentRequirement["resource"];
}

interface SurplusExactPayload {
  x402Version: number;
  selectedScheme: "exact";
  scheme: "exact";
  payType: "exact";
  payment: string;
  payTo: string;
  network: string;
  asset: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
  resource: SurplusPaymentRequirement["resource"];
}

interface SurplusUptoPayload {
  x402Version: number;
  selectedScheme: "upto";
  scheme: "upto";
  payType: "upto";
  maxPayment: string;
  payTo: string;
  network: string;
  asset: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
  resource: SurplusPaymentRequirement["resource"];
  // Permit2 witness fields (only needed for signing, not serialized to JSON)
  witness?: SurplusPaymentWitness;
  transferDetails?: {
    to: string;
    token: string;
    amount: string;
    expiry: number;
  };
  permit?: {
    permitted: { token: string; amount: string };
    spender: string;
    nonce: bigint;
    deadline: bigint;
  };
}

type SurplusPayload = SurplusExactPayload | SurplusUptoPayload;

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

async function buildPaymentPayload(
  paymentData: SurplusPaymentRequirement,
  _originalBody: Record<string, unknown>
): Promise<SurplusPayload> {
  const upto = paymentData.accepts.find((a) => a.scheme === "upto");
  const exact = paymentData.accepts.find((a) => a.scheme === "exact");
  const selected = upto || exact;

  if (!selected) {
    throw Object.assign(
      new Error("No supported x402 payment scheme available from Surplus"),
      { status: 402 }
    );
  }

  if (selected.scheme === "upto") {
    // build Permit2 witness + transferDetails for PermitWitnessTransferFrom signing
    // nonce must be cryptographically random — on-chain replay protection
    const nonce = BigInt("0x" + randomBytes(32).toString("hex"));
    const deadline =
      BigInt(Math.floor(Date.now() / 1000)) +
      BigInt(selected.maxTimeoutSeconds);

    const payload: SurplusUptoPayload = {
      x402Version: paymentData.x402Version,
      selectedScheme: "upto",
      scheme: "upto",
      payType: "upto",
      maxPayment: selected.amount,
      payTo: selected.payTo,
      network: selected.network,
      asset: selected.asset,
      maxTimeoutSeconds: selected.maxTimeoutSeconds,
      extra: selected.extra,
      resource: paymentData.resource,
      witness: {
        payTo: selected.payTo,
        asset: selected.asset,
        amount: selected.amount,
        network: selected.network,
        resource: paymentData.resource,
      },
      transferDetails: {
        to: selected.payTo,
        token: selected.asset,
        amount: selected.amount,
        expiry: Number(deadline),
      },
      permit: {
        permitted: {
          token: selected.asset,
          amount: selected.amount,
        },
        spender: config.SURPLUS_SETTLEMENT_CONTRACT ?? "0x0770d2124C0a581C28Cfc47a659817145e6Cc137",
        nonce,
        deadline,
      },
    };
    return payload;
  } else {
    // exact: EIP-3009 TransferWithAuthorization
    const payload: SurplusExactPayload = {
      x402Version: paymentData.x402Version,
      selectedScheme: "exact",
      scheme: "exact",
      payType: "exact",
      payment: selected.amount,
      payTo: selected.payTo,
      network: selected.network,
      asset: selected.asset,
      maxTimeoutSeconds: selected.maxTimeoutSeconds,
      extra: selected.extra,
      resource: paymentData.resource,
    };
    return payload;
  }
}

// ---------------------------------------------------------------------------
// EIP-712 type constants
// ---------------------------------------------------------------------------

// EIP-3009 TransferWithAuthorization (exact scheme)
const EIP3009_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: 8453,
  verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
} as const;

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// Permit2 PermitWitnessTransferFrom (upto scheme)
const PERMIT2_DOMAIN = {
  name: "Permit2",
  version: "1",
  chainId: 8453,
  verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

// Surplus Payment witness type for upto scheme
const SURPLUS_PAYMENT_TYPES = {
  Payment: [
    { name: "payTo", type: "address" },
    { name: "asset", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "network", type: "string" },
    { name: "resource", type: "Resource" },
  ],
  Resource: [
    { name: "url", type: "string" },
    { name: "description", type: "string" },
    { name: "mimeType", type: "string" },
  ],
} as const;

const PERMIT_TYPES = {
  Permit: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  TransferDetails: [
    { name: "to", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

const PERMITWITNESS_TYPES = {
  PermitWitnessTransferFrom: [
    { name: "permit", type: "Permit" },
    { name: "transferDetails", type: "TransferDetails" },
    { name: "witness", type: "Payment" },
  ],
  ...PERMIT_TYPES,
  ...SURPLUS_PAYMENT_TYPES,
} as const;

// ---------------------------------------------------------------------------
// Scheme-aware signer
// ---------------------------------------------------------------------------

async function signPayment(
  payload: SurplusPayload
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

  const chainId = config.SURPLUS_CHAIN_ID ?? 8453;
  const usdcContract = (config.SURPLUS_USDC_CONTRACT ??
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`;
  const permit2Contract = (config.SURPLUS_PERMIT2_CONTRACT ??
    "0x000000000022D473030F116dDEE9F6B43aC78BA3") as `0x${string}`;
  const settlementContract = (config.SURPLUS_SETTLEMENT_CONTRACT ??
    "0x0770d2124C0a581C28Cfc47a659817145e6Cc137") as `0x${string}`;

  try {
    const account = privateKeyToAccount(`0x${walletPrivateKey.replace("0x", "")}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    let signature: Hex;

    if (payload.selectedScheme === "exact") {
      // EIP-3009 TransferWithAuthorization
      const now = Math.floor(Date.now() / 1000);
      // nonce must be cryptographically random — on-chain replay protection
      const nonce = ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
      const validAfter = BigInt(now - 60); // allow 60s clock skew
      const validBefore = BigInt(now + payload.maxTimeoutSeconds);

      const domain = {
        name: EIP3009_DOMAIN.name,
        version: EIP3009_DOMAIN.version,
        chainId,
        verifyingContract: usdcContract,
      };

      signature = await walletClient.signTypedData({
        domain,
        types: EIP3009_TYPES,
        primaryType: "TransferWithAuthorization",
        message: {
          from: account.address,
          to: payload.payTo as `0x${string}`,
          value: BigInt(payload.payment),
          validAfter,
          validBefore,
          nonce,
        },
      });
    } else {
      // Permit2 PermitWitnessTransferFrom (upto scheme)
      if (!isSurplusUptoPayload(payload)) {
        throw Object.assign(
          new Error("Invalid upto payload: missing Permit2 witness fields"),
          { status: 500 }
        );
      }

      const { permit, transferDetails, witness } = payload;
      if (!permit || !transferDetails || !witness) {
        throw Object.assign(
          new Error("Invalid upto payload: missing Permit2 witness fields"),
          { status: 500 }
        );
      }

      const domain = {
        name: PERMIT2_DOMAIN.name,
        version: PERMIT2_DOMAIN.version,
        chainId,
        verifyingContract: permit2Contract,
      };

      signature = await walletClient.signTypedData({
        domain,
        types: PERMITWITNESS_TYPES,
        primaryType: "PermitWitnessTransferFrom",
        message: {
          permit: {
            permitted: {
              token: permit.permitted.token as `0x${string}`,
              amount: BigInt(permit.permitted.amount),
            },
            spender: settlementContract,
            nonce: permit.nonce,
            deadline: permit.deadline,
          },
          transferDetails: {
            to: transferDetails.to as `0x${string}`,
            token: transferDetails.token as `0x${string}`,
            amount: BigInt(transferDetails.amount),
            expiry: BigInt(transferDetails.expiry),
          },
          witness: {
            payTo: witness.payTo as `0x${string}`,
            asset: witness.asset as `0x${string}`,
            amount: BigInt(witness.amount),
            network: witness.network,
            resource: {
              url: witness.resource.url,
              description: witness.resource.description,
              mimeType: witness.resource.mimeType,
            },
          },
        },
      });
    }

    return signature;
  } catch (err) {
    logger.error(
      { error: (err as Error).message, scheme: payload.selectedScheme },
      "Surplus x402 payment signing failed"
    );
    throw Object.assign(
      new Error("Failed to sign Surplus payment"),
      { status: 500 }
    );
  }
}

// Type guard for upto payload
function isSurplusUptoPayload(p: SurplusPayload): p is SurplusUptoPayload {
  return p.selectedScheme === "upto";
}

/**
 * Convert a SurplusPayload to a JSON-serializable plain object.
 * Strips internal signing fields (BigInt nonce/deadline) and converts
 * BigInt amounts to decimal strings for JSON.stringify compatibility.
 */
function serializePayloadForJson(payload: SurplusPayload): Record<string, unknown> {
  const base: Record<string, unknown> = {
    x402Version: payload.x402Version,
    selectedScheme: payload.selectedScheme,
    payType: payload.payType,
    payTo: payload.payTo,
    network: payload.network,
    asset: payload.asset,
    maxTimeoutSeconds: payload.maxTimeoutSeconds,
    resource: payload.resource,
    extra: payload.extra,
  };

  if (payload.selectedScheme === "exact") {
    return { ...base, payment: payload.payment, scheme: "exact" };
  } else {
    return { ...base, maxPayment: payload.maxPayment, scheme: "upto" };
  }
}

export async function surplusListModels(): Promise<SurplusModelsResponse> {
  const tracer = trace.getTracer("oma-server");
  const endpoint = `/v1/models`;

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
  const endpoint = `/v1/models`;

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
