/**
 * Deposit API namespace.
 * Server: /Users/tyson/Desktop/Code/OMA-AI/app/server/src/routes/deposit/

 * Methods return promises that resolve to shapes matching consumer expectations
 * in app/swap/page.tsx, app/admin/page.tsx, and components/dashboard/NotificationBell.tsx.
 */
import { request } from './client.js';

export const deposit = {
  /** USDC deposit — fetch deposit address for a given amount. */
  async usdc(amount: number, txHash: string) {
    return request('/v1/deposit/usdc', {
      method: 'POST',
      body: JSON.stringify({ amount, txHash }),
    });
  },

  /** OMA token deposit. */
  async oma(amount: number, txHash: string) {
    return request('/v1/deposit/oma', {
      method: 'POST',
      body: JSON.stringify({ amount, txHash }),
    });
  },

  /** Houdini swap deposit. */
  async houdini(fromCoin: string, amount: string, quoteId?: string, swapType?: string) {
    return request('/v1/deposit/houdini', {
      method: 'POST',
      body: JSON.stringify({ fromCoin, amount, quoteId, swapType }),
    });
  },

  /** Houdini supported tokens for a blockchain. */
  async houdiniTokens(blockchain: string) {
    return request(`/v1/deposit/houdini/tokens?blockchain=${blockchain}`);
  },

  /** Houdini quote for a swap — returns array of quote objects. */
  async houdiniQuote(
    fromSymbol: string,
    toSymbol: string,
    amount: string,
    privacyMode?: string,
    slippage?: number,
  ) {
    const params = new URLSearchParams({
      from: fromSymbol,
      to: toSymbol,
      amount,
    });
    if (privacyMode) params.set('privacy', privacyMode);
    if (slippage !== undefined) params.set('slippage', String(slippage));
    return request(`/v1/deposit/houdini/quote?${params.toString()}`);
  },

  /** Houdini exchange — execute a swap. */
  async houdiniExchange(
    quoteId: string,
    fromSymbol: string,
    amount: string,
    recipient: string,
  ) {
    return request('/v1/deposit/houdini/exchange', {
      method: 'POST',
      body: JSON.stringify({ quoteId, fromSymbol, amount, recipient }),
    });
  },

  /** Deposit status by ID. */
  async status(id: string) {
    return request(`/v1/deposit/status?id=${id}`);
  },

  /** Notifications related to deposits. */
  async getNotifications() {
    return request('/v1/deposit/notifications');
  },
};
