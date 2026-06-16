/**
 * Auth namespace: SIWE + Solana + account-number login + API key listing.
 */
import type {
  ApiKey,
  NonceResponse,
  Session,
  User,
  VerifyResponse,
  WalletResponse,
} from './types.js';
import { request } from './client.js';

export const auth = {
  getNonce(address: string) {
    return request<NonceResponse>('/auth/nonce', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  },

  verify(message: string, signature: string, type: 'siwe') {
    return request<VerifyResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature, type }),
    });
  },

  solana: {
    getChallenge(address: string) {
      return request<{ message: string }>('/auth/solana/challenge', {
        method: 'POST',
        body: JSON.stringify({ address }),
      });
    },
    verify(address: string, message: string, signature: string) {
      return request<{ token: string }>('/auth/solana/verify', {
        method: 'POST',
        body: JSON.stringify({ address, message, signature }),
      });
    },
  },

  wallet(message: string, signature: string) {
    return request<WalletResponse>('/auth/wallet', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    });
  },

  logout() {
    return request<void>('/auth/logout', { method: 'POST' });
  },

  unlinkWallet(type: 'evm') {
    return request<void>(`/auth/wallet/${type}`, { method: 'DELETE' });
  },

  getUser() {
    return request<User>('/user');
  },

  deleteAccount() {
    return request<void>('/account', { method: 'DELETE' });
  },

  getCsrfToken() {
    return request<{ token: string }>('/auth/csrf-token');
  },

  createAccountNumber() {
    return request<{ accountNumber: string }>('/auth/account/create', { method: 'POST' });
  },

  loginWithAccountNumber(accountNumber: string) {
    return request<{ token: string; address: string; hasApiKey: boolean }>('/auth/account/login', {
      method: 'POST',
      body: JSON.stringify({ accountNumber }),
    });
  },

  listKeys() {
    return request<{ keys: ApiKey[] }>('/keys').then((res) => res.keys);
  },

  listSessions() {
    return request<{ sessions: Session[] }>('/auth/sessions').then((res) => res.sessions);
  },

  /**
   * C-C1: start a 24h demo session. Sets the `oma-demo=1` cookie server-side
   * (so it survives the same protected-route middleware that reads it) and
   * returns once the cookie is in the response. After this call resolves,
   * `wallet-provider.tsx`'s `isDemo` becomes true and the dashboard renders
   * with mock data.
   */
  startDemo() {
    return request<{ success: boolean; expiresIn: number }>('/auth/demo', {
      method: 'POST',
    });
  },
};
