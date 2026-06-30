/**
 * Shared API response types for the oma-ai frontend.
 * Mirrors the shapes returned by the Hono backend in `server/src/routes/`.
 */

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface NonceResponse {
  nonce: string;
}

export interface User {
  id: string;
  address: string;
  evmAddress: string | null;
  accountNumber: string | null;
  createdAt: string;
  /** Whether TOTP 2FA is enabled on the account. */
  twoFactorEnabled?: boolean;
  /** Number of unused backup codes remaining after 2FA setup. */
  backupCodesRemaining?: number;
  /** ISO timestamp of last password change (null for wallet-only accounts). */
  lastPasswordChange?: string | null;
}

/** Response from POST /auth/verify (SIWE login). */
export interface VerifyResponse {
  token: string;
  /** The signer's address (0x… for EVM). */
  address: string;
  /** Mullvad-style 16-digit account number. */
  accountNumber: string;
  authMethod: "siwe";
}

/** Response from POST /auth/wallet (link wallet & get API key). */
export interface WalletResponse {
  apiKey: string | null;
  prefix: string;
  id: string;
  name: string;
  createdAt: string;
  /** Present when a wallet key already exists. */
  warning?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

// ─── Credits / Balance / Usage ────────────────────────────────────────────────

export interface BalanceResponse {
  balanceCents: string;
  totalDepositedCents: string;
  totalUsedCents: string;
  lastActivityAt: string | null;
}

export interface UsageRecord {
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costCents: string;
  provider?: string;
  latencyMs?: number | null;
  status?: string;
  createdAt: string;
}

export interface CreditBatch {
  id: string;
  amountCents: string;
  remainingCents: string;
  expiresAt: string;
  paymentMethod: string | null;
}

export interface PurchaseCreditsResponse {
  success: boolean;
  creditsAdded: number;
  expiresAt: string;
  depositId: string;
  paymentMethod: string;
  autoReloadEnabled: boolean;
}

export interface AutoReloadSettings {
  enabled: boolean;
  thresholdCents: number;
  reloadAmountCents: number;
  spendLimitCents: number;
  paymentMethod: string;
}

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

export interface ModelsResponse {
  object: 'list';
  data: Model[];
}

// ─── Deposit ──────────────────────────────────────────────────────────────────

export interface DepositStatus {
  id: string;
  type?: string;
  status: 'pending' | 'settling' | 'completed' | 'failed' | 'refunded' | 'expired';
  amountUsd?: string;
  creditsIssued?: string;
  amountCents?: string;
  createdAt: string;
  settledAt?: string | null;
  txHash?: string | null;
  fromAmount?: string;
  toAmount?: string;
  houdiniStatus?: string;
  pollError?: string;
}

export interface HoudiniDepositResult {
  depositAddress: string;
  depositId: string;
  orderId: string;
}

export interface HoudiniExchangeResult {
  depositId: string;
  depositAddress: string;
  orderId: string;
  fromAmount: string;
  toAmount: string;
  status: string;
  expiresAt: string;
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  blockchain: string;
  network?: string;
  logoUrl?: string;
}

export interface Quote {
  quoteId: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  estimatedTime: number;
  swapType: string;
  slippage: number;
}

// ─── Inference / Chat ─────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded' | string;
  version: string;
  service: string;
  uptime: number;
  correlationId: string;
  checks: Record<
    string,
    { status: 'ok' | 'degraded' | 'rate_limited' | 'circuit_open' | string; latency?: number; cooldownMs?: number }
  >;
}

export interface ChatCompletionsResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── x402 payment protocol ────────────────────────────────────────────────────

export interface X402VerifyResponse {
  valid: boolean;
  address?: string;
  error?: string;
}

export interface X402SettleResponse {
  settled: boolean;
  receipt?: string;
  error?: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
  current: boolean;
}
