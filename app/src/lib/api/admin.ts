/**
 * Admin namespace: user/usage/revenue/keys dashboards.
 * All endpoints require admin role — server enforces via middleware/rbac.ts.
 */
import { request } from './client.js';

export const admin = {
  getStats: () =>
    request<{
      totalUsers: number;
      totalApiKeys: number;
      totalCreditsPurchased: number;
      totalUsageThisMonth: number;
      revenue: number;
      activeUsersLast24h: number;
      providerCosts: { venice: number; openrouter: number };
    }>('/admin/stats'),

  getUsers: (page = 1, limit = 50) =>
    request<{
      users: Array<{
        id: string;
        address: string;
        solanaAddress: string | null;
        accountNumber: string | null;
        createdAt: string;
        lastActivityAt: string | null;
        balanceCredits: number;
        totalDeposited: number;
        totalUsed: number;
        totalRequests: number;
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/admin/users?page=${page}&limit=${limit}`),

  getUserDetail: (id: string) =>
    request<{
      user: {
        id: string;
        address: string;
        solanaAddress: string | null;
        accountNumber: string | null;
        createdAt: string;
      };
      balance: { balanceCredits: number; totalDeposited: number; totalUsed: number };
      apiKeys: Array<{
        id: string;
        keyPrefix: string;
        name: string;
        active: boolean;
        createdAt: string;
        totalRequests: number;
        totalSpend: number;
      }>;
      recentUsage: Array<{
        id: string;
        model: string;
        provider: string;
        inputTokens: number;
        outputTokens: number;
        cost: number;
        createdAt: string;
      }>;
      recentDeposits: Array<{
        id: string;
        type: string;
        amount: number;
        credits: number;
        status: string;
        txHash: string | null;
        createdAt: string;
      }>;
    }>(`/admin/users/${id}`),

  getUsage: (period = '30d') =>
    request<{
      period: string;
      summary: {
        totalRequests: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalRevenue: number;
        totalCost: number;
        grossProfit: number;
        margin: string;
      };
      byProvider: Array<{
        provider: string;
        totalRequests: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalRevenue: number;
        totalCost: number;
        profit: number;
      }>;
      byModel: Array<{
        model: string;
        provider: string;
        totalRequests: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalRevenue: number;
      }>;
      dailyUsage: Array<{ date: string; totalRequests: number; totalRevenue: number }>;
    }>(`/admin/usage?period=${period}`),

  getRevenue: (period = '30d') =>
    request<{
      period: string;
      summary: {
        totalRevenue: number;
        totalCost: number;
        grossProfit: number;
        totalDeposits: number;
        depositCount: number;
        newUsers: number;
      };
      monthlyRevenue: Array<{ month: string; totalRevenue: number; depositCount: number }>;
    }>(`/admin/revenue?period=${period}`),

  getKeys: (page = 1, limit = 100) =>
    request<{
      keys: Array<{
        id: string;
        userId: string;
        userAddress: string;
        keyPrefix: string;
        name: string;
        active: boolean;
        createdAt: string;
        totalRequests: number;
        totalSpend: number;
        lastUsedAt: string | null;
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/admin/keys?page=${page}&limit=${limit}`),
};
