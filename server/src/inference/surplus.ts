import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { logger } from "../lib/logger.js";

const SURPLUS_TIMEOUT_MS = 60_000;
const SURPLUS_BASE_URL = "https://www.surplusintelligence.ai";
const SURPLUS_API_VERSION = "v1";

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
  [key: string]: unknown;
}): Promise<Response> {
  const tracer = trace.getTracer("oma-server");
  const endpoint = `/x402/api/inference/${SURPLUS_API_VERSION}/chat/completions`;
  const requestBody = {
    model: body.model,
    messages: body.messages,
    stream: body.stream ?? false,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SURPLUS_TIMEOUT_MS);

  return tracer.startActiveSpan("llm.provider.surplus", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "surplus");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", `${SURPLUS_BASE_URL}${endpoint}`);

      const probeResponse = await surplusFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(requestBody),
        signal: controller.signal,
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
        const _signature = await signPayment(paymentPayload);

        const retryResponse = await surplusFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(requestBody),
          signal: controller.signal,
          paymentSignature: Buffer.from(JSON.stringify(paymentPayload)).toString("base64"),
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
        chainId: 8453,
        verifyingContract: "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402",
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