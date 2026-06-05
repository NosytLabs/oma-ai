/**
 * Webhooks: user-configured event subscriptions (deposit.completed, etc).
 * Recoveries: cross-chain deposit recovery flow for wrong-network sends.
 */
import { request } from './client.js';

export const webhooks = {
  list() {
    return request<{
      subscriptions: Array<{
        id: string;
        url: string;
        event: string;
        events: string[];
        active: boolean;
        lastNotificationAt: string | null;
        lastNotificationStatus: string | null;
        notificationCount: number;
        createdAt: string;
      }>;
    }>('/v1/webhooks');
  },

  create(data: { url: string; events?: string[]; secret?: string }) {
    return request<{ id: string; success: boolean }>('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete(subscriptionId: string) {
    return request<{ success: boolean }>(`/v1/webhooks/${subscriptionId}`, { method: 'DELETE' });
  },
};

export const recoveries = {
  list() {
    return request<{
      recoveries: Array<{
        id: string;
        originalTxHash: string;
        recoveryTxHash: string | null;
        amountUsd: string;
        status: string;
        rejectionReason: string | null;
        createdAt: string;
        completedAt: string | null;
      }>;
    }>('/v1/recoveries');
  },

  initiate(data: { wrongNetworkTxHash: string; recoveryTxHash: string }) {
    return request<{
      success: boolean;
      recoveryId: string;
      creditsRecovered: number;
    }>('/v1/recoveries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  scan(address: string) {
    return request<{
      deposits: Array<{
        txHash: string;
        amount: string;
        fromAddress: string;
        toAddress: string;
        blockNumber: string;
        timestamp: string;
      }>;
    }>(`/v1/recoveries/scan?address=${address}`);
  },
};
