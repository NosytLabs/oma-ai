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
  solanaAddress: string | null;
  accountNumber: string | null;
  createdAt: string;
}

export interface VerifyResponse {
  token: string;
  user: User;
}

export interface WalletResponse {
  address: string;
  balanceCents: number;
  totalDeposited: number;
  totalUsed: number;
  sessionLimit: number;
  sessionUsed: number;
  promoBalanceCents: number;
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
  createdAt: string;
}

export interface UsageResponse {
  usage: UsageRecord[];
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

export interface PendingDeposit {
  id: string;
  type: 'usdc' | 'oma' | 'houdini';
  amountCents: string;
  status: string;
  createdAt: string;
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

export type SupportedCoin = Token;

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  blockchain: string;
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

export interface Order {
  orderId: string;
  quoteId: string;
  status: OrderStatus;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  depositAddress: string;
  expiresAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'deposit_received'
  | 'swapping'
  | 'settling'
  | 'completed'
  | 'expired'
  | 'failed';

// ─── Inference / Chat ─────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  service: string;
  uptime: number;
  correlationId: string;
  checks: {
    redis?: { status: string; latency?: number };
    database?: { status: string; latency?: number };
    venice?: { status: string; latency?: number };
  };
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
