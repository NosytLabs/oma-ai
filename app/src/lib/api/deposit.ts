/**
 * Deposit namespace: USDC, OMA, Houdini swap, status, recovery.
 * Successful deposits invalidate the /v1/balance cache.
 */
import type {
  Chain,
  DepositStatus,
  HoudiniDepositResult,
  HoudiniExchangeResult,
  PendingDeposit,
  Quote,
  Token,
} from './types.js';
import { invalidateCache, request } from './client.js';

export const deposit = {
  usdc(amount: number, txHash: string) {
    invalidateCache('/v1/balance');
    return request<DepositStatus>('/v1/deposit/usdc', {
      method: 'POST',
      body: JSON.stringify({ amount, txHash }),
    });
  },

  oma(amount: number, txHash: string) {
    invalidateCache('/v1/balance');
    return request<DepositStatus>('/v1/deposit/oma', {
      method: 'POST',
      body: JSON.stringify({ amount, txHash }),
    });
  },

  houdini(fromCoin: string, amount: string, quoteId?: string, swapType?: string) {
    return request<HoudiniDepositResult>('/v1/deposit/houdini', {
      method: 'POST',
      body: JSON.stringify({ fromCoin, amount, quoteId, swapType }),
    });
  },

  status(id: string) {
    return request<DepositStatus>(`/v1/deposit/status/${id}`);
  },

  pending() {
    return request<PendingDeposit[]>('/v1/deposit/pending');
  },

  houdiniTokens(blockchain: string = 'BASE') {
    return request<Token[]>(`/v1/deposit/houdini/tokens?blockchain=${blockchain}`);
  },

  houdiniChains() {
    return request<Chain[]>('/v1/deposit/houdini/chains');
  },

  houdiniQuote(fromToken: string, toToken: string, amount: string, swapType?: string, slippageTolerance?: number) {
    return request<Quote[]>('/v1/deposit/houdini/quote', {
      method: 'POST',
      body: JSON.stringify({ fromToken, toToken, amount, swapType, slippageTolerance }),
    });
  },

  houdiniExchange(quoteId: string, fromCoin: string, fromAmount: string, refundAddress?: string) {
    return request<HoudiniExchangeResult>('/v1/deposit/houdini/exchange', {
      method: 'POST',
      body: JSON.stringify({ quoteId, fromCoin, fromAmount, refundAddress }),
    });
  },

  getStatus() {
    return request<{
      deposits: Array<{
        id: string;
        type: string;
        status: string;
        amountUsd: string;
        creditsIssued: string;
        txHash: string | null;
        createdAt: string;
        completedAt: string | null;
      }>;
    }>('/v1/deposit/status');
  },

  getById(depositId: string) {
    return request<{
      deposit: {
        id: string;
        type: string;
        status: string;
        amountUsd: string;
        creditsIssued: string;
        txHash: string | null;
        houdiniId: string | null;
        createdAt: string;
        completedAt: string | null;
      };
      retryStatus: {
        attempts: number;
        canRetry: boolean;
        nextRetryAt: string | null;
        status: string;
      } | null;
    }>(`/v1/deposit/${depositId}`);
  },

  retry(depositId: string) {
    return request<{ success: boolean; message: string }>(
      `/v1/deposit/${depositId}/retry`,
      { method: 'POST' },
    );
  },

  getNotifications() {
    return request<{
      notifications: Array<{
        id: string;
        depositId: string;
        type: string;
        status: string;
        amountUsd: string | null;
        creditsIssued: string | null;
        txHash: string | null;
        method: string | null;
        createdAt: string;
        notifiedAt: string | null;
      }>;
    }>('/v1/notifications');
  },
};
