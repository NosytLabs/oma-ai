export type X402Version = "1" | "2";

export interface PaymentPayload {
  x402Version: X402Version;
  scheme: "evm" | "solana";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  payFrom: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
  // ponytail: per-payload random nonce for replay protection. Optional for
  // backward compat; v2 clients SHOULD include it. The verify path consumes
  // it via Redis SETNX with NONCE_REDIS_TTL_SECONDS TTL — a second use of
  // the same nonce returns 422 payment_replay.
  nonce?: string;
}

export interface PaymentSignature {
  x402Version: X402Version;
  signature: string;
  authorization: string;
  payload: PaymentPayload;
}

export interface PaymentRequired {
  x402Version: X402Version;
  scheme: "evm" | "solana";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
  "payment-URL"?: string;
}

export interface PaymentResponse {
  valid: boolean;
  txHash?: string;
  amount?: string;
  networkId?: string;
  error?: string;
}

export interface SettlementRecord {
  txHash: string;
  amount: string;
  networkId: string;
  payee: string;
  settledAt: number;
  receipt: string;
}

export interface SettlementResponse {
  settled: boolean;
  receipt: string;
  error?: string;
}

export interface PaymentMiddlewareConfig {
  pricing: Record<string, string>;
  payeeAddress: string;
  asset?: string;
  networkId?: string;
  scheme?: "evm" | "solana";
}

export interface SolanaInstruction {
  parsed?: {
    type: string;
    info: {
      destination?: string;
      lamports?: string;
      amount?: string;
      mint?: string;
      tokenAmount?: { amount?: string; decimals?: number };
    };
  };
}

export interface SolanaRpcResponse {
  result?: {
    meta?: { err?: unknown };
    transaction?: {
      message?: {
        instructions?: SolanaInstruction[];
      };
    };
  };
  error?: { message?: string; code?: number };
}