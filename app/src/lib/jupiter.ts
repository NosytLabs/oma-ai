/**
 * Jupiter Swap API Client for Solana Deposits
 * Handles SOL and SPL token swaps to USDC for OMA deposits
 * 
 * Key Endpoints:
 * - GET https://api.jup.ag/swap/v2/order (quote + transaction)
 * - POST https://api.jup.ag/swap/v2/execute (execute)
 */

export const JUPITER_API_BASE = "https://api.jup.ag";
export const JUPITER_API_VERSION = "v2";

// Solana token addresses
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Referral fee: 50 = 0.5%
export const REFERRAL_FEE = 50;

export interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
}

export interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number; // in lamports or smallest unit
  slippageBps: number; // basis points (100 = 1%)
  slippageMode?: "ExactIn" | "ExactOut";
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  referralFee?: number;
  platformFeeBps?: number;
  computeUnits?: number;
  prioritizationFeeLamports?: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRoutePlan[];
  timeTaken: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  // Additional fields from Jupiter
  contextSlot?: number;
  undefined?: string;
}

export interface JupiterRoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  computeBudget?: number;
  prioritizationFeeLamports?: number;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  destinationTokenAccount?: string;
  computeUnits?: number;
  asLegacyTransaction?: boolean;
  useVersionedTransaction?: boolean;
  autoScroll?: boolean;
  openOrdersAddress?: string;
  destination?: string;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  simulation?: {
    success: boolean;
    unitsConsumed: number;
    logs: string[];
  };
}

export interface JupiterTokenListResponse {
  tokens: JupiterToken[];
}

// Referral account (OMA's Jupiter partner account)
export interface ReferralConfig {
  referralFee: number;
  referralAccount?: string;
}

/**
 * Fetch available tokens from Jupiter
 */
export async function getJupiterTokens(): Promise<JupiterToken[]> {
  const response = await fetch(`${JUPITER_API_BASE}/swap/v6/tokens`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Jupiter tokens: ${response.statusText}`);
  }

  const data: JupiterTokenListResponse = await response.json();
  return data.tokens;
}

/**
 * Get a quote for swapping tokens via Jupiter
 */
export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number; // in lamports/smallest unit
  slippageBps?: number; // default 50 = 0.5%
  referralFee?: number;
  platformFeeBps?: number;
}): Promise<JupiterQuoteResponse> {
  const { inputMint, outputMint, amount, slippageBps = 50, referralFee, platformFeeBps } = params;

  const queryParams = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    onlyDirectRoutes: "false",
    asLegacyTransaction: "false",
  });

  if (referralFee) {
    queryParams.set("referralFee", referralFee.toString());
  }

  if (platformFeeBps) {
    queryParams.set("platformFeeBps", platformFeeBps.toString());
  }

  const response = await fetch(`${JUPITER_API_BASE}/swap/v2/quote?${queryParams.toString()}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Jupiter quote: ${error}`);
  }

  return response.json();
}

/**
 * Get swap transaction for a quote
 */
export async function getSwapTransaction(params: {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  computeBudget?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
}): Promise<JupiterSwapResponse> {
  const { quoteResponse, userPublicKey, wrapAndUnwrapSol = true, computeBudget, prioritizationFeeLamports, asLegacyTransaction = false } = params;

  const body: Record<string, unknown> = {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol,
    asLegacyTransaction,
  };

  if (computeBudget) {
    body.computeBudget = computeBudget;
  }

  if (prioritizationFeeLamports) {
    body.prioritizationFeeLamports = prioritizationFeeLamports;
  }

  const response = await fetch(`${JUPITER_API_BASE}/swap/v2/swap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get swap transaction: ${error}`);
  }

  return response.json();
}

/**
 * Get quote with direct order endpoint (combines quote + tx)
 */
export async function getQuoteAndTransaction(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  userPublicKey: string;
  slippageBps?: number;
  wrapAndUnwrapSol?: boolean;
  referralFee?: number;
  computeBudget?: number;
  prioritizationFeeLamports?: number;
}): Promise<{
  quote: JupiterQuoteResponse;
  swapTransaction: string;
  lastValidBlockHeight: number;
}> {
  const { inputMint, outputMint, amount, userPublicKey, slippageBps = 50, wrapAndUnwrapSol = true, referralFee } = params;

  const queryParams = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    userPublicKey,
    wrapAndUnwrapSol: wrapAndUnwrapSol.toString(),
    asLegacyTransaction: "false",
  });

  if (referralFee) {
    queryParams.set("referralFee", referralFee.toString());
  }

  const response = await fetch(`${JUPITER_API_BASE}/swap/v2/order?${queryParams.toString()}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get quote and transaction: ${error}`);
  }

  return response.json();
}

/**
 * Execute a pre-built swap transaction
 */
export async function executeSwap(params: {
  swapTransaction: string;
}): Promise<{
  txid: string;
}> {
  const response = await fetch(`${JUPITER_API_BASE}/swap/v2/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      swapTransaction: params.swapTransaction,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to execute swap: ${error}`);
  }

  return response.json();
}

/**
 * Convert SOL to USDC quote
 */
export async function getSolToUsdcQuote(solAmount: number, slippageBps = 50): Promise<JupiterQuoteResponse> {
  // SOL amounts are in lamports (1 SOL = 1e9 lamports)
  const amountLamports = Math.round(solAmount * 1e9);
  
  return getQuote({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amount: amountLamports,
    slippageBps,
  });
}

/**
 * Get swap transaction for SOL to USDC
 */
export async function getSolToUsdcSwapTx(params: {
  solAmount: number;
  userPublicKey: string;
  slippageBps?: number;
  wrapAndUnwrapSol?: boolean;
  referralFee?: number;
}): Promise<{
  quote: JupiterQuoteResponse;
  swapTransaction: string;
  lastValidBlockHeight: number;
}> {
  const { solAmount, userPublicKey, slippageBps = 50, wrapAndUnwrapSol = true, referralFee } = params;
  
  const amountLamports = Math.round(solAmount * 1e9);
  
  return getQuoteAndTransaction({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amount: amountLamports,
    userPublicKey,
    slippageBps,
    wrapAndUnwrapSol,
    referralFee,
  });
}

/**
 * Jupiter API client class for cleaner usage
 */
export class JupiterClient {
  private referralFee: number;
  private slippageBps: number;
  private wrapAndUnwrapSol: boolean;

  constructor(options?: {
    referralFee?: number;
    slippageBps?: number;
    wrapAndUnwrapSol?: boolean;
  }) {
    this.referralFee = options?.referralFee ?? REFERRAL_FEE;
    this.slippageBps = options?.slippageBps ?? 50;
    this.wrapAndUnwrapSol = options?.wrapAndUnwrapSol ?? true;
  }

  /**
   * Get quote for SOL to USDC swap
   */
  async getSolQuote(solAmount: number): Promise<JupiterQuoteResponse> {
    const amountLamports = Math.round(solAmount * 1e9);
    return getQuote({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: amountLamports,
      slippageBps: this.slippageBps,
      referralFee: this.referralFee,
    });
  }

  /**
   * Get quote for any token swap
   */
  async getQuote(inputMint: string, outputMint: string, amount: number): Promise<JupiterQuoteResponse> {
    return getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: this.slippageBps,
      referralFee: this.referralFee,
    });
  }

  /**
   * Get swap transaction for SOL to USDC
   */
  async getSolSwapTx(solAmount: number, userPublicKey: string): Promise<{
    quote: JupiterQuoteResponse;
    swapTransaction: string;
    lastValidBlockHeight: number;
  }> {
    return getSolToUsdcSwapTx({
      solAmount,
      userPublicKey,
      slippageBps: this.slippageBps,
      wrapAndUnwrapSol: this.wrapAndUnwrapSol,
      referralFee: this.referralFee,
    });
  }

  /**
   * Get swap transaction for any token swap
   */
  async getSwapTx(
    inputMint: string,
    outputMint: string,
    amount: number,
    userPublicKey: string
  ): Promise<{
    quote: JupiterQuoteResponse;
    swapTransaction: string;
    lastValidBlockHeight: number;
  }> {
    return getQuoteAndTransaction({
      inputMint,
      outputMint,
      amount,
      userPublicKey,
      slippageBps: this.slippageBps,
      wrapAndUnwrapSol: this.wrapAndUnwrapSol,
      referralFee: this.referralFee,
    });
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(swapTransaction: string): Promise<{ txid: string }> {
    return executeSwap({ swapTransaction });
  }

  /**
   * Get available tokens
   */
  async getTokens(): Promise<JupiterToken[]> {
    return getJupiterTokens();
  }
}

// Default client instance
export const jupiterClient = new JupiterClient({
  referralFee: REFERRAL_FEE,
  slippageBps: 50,
  wrapAndUnwrapSol: true,
});

// Helper to format Jupiter amounts
export function formatJupiterAmount(amount: string, decimals: number): number {
  return parseFloat(amount) / Math.pow(10, decimals);
}

// Helper to parse SOL amount to lamports
export function solToLamports(solAmount: number): number {
  return Math.round(solAmount * 1e9);
}

// Helper to parse lamports to SOL
export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}