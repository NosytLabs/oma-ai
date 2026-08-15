import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDashboardData } from '../useDashboardData';
import { api, BackendUnavailableError } from '@/lib/api';
import { useBalance } from '@/components/chat/useBalance';

// Mock dependencies
vi.mock('@/lib/api', () => ({
		api: {
				auth: { listKeys: vi.fn() },
				usage: { get: vi.fn() },
				credits: { getBatches: vi.fn() },
				models: { list: vi.fn() },
				creditHistory: { list: vi.fn() }
		},
		BackendUnavailableError: class BackendUnavailableError extends Error {
				constructor() {
						super('Backend unavailable');
						this.name = 'BackendUnavailableError';
				}
		}
}));

vi.mock('@/components/chat/useBalance', () => ({
		useBalance: vi.fn()
}));

const createWrapper = () => {
		const queryClient = new QueryClient({
				defaultOptions: {
						queries: {
								retry: false,
						},
				},
		});
		return ({ children }: { children: React.ReactNode }) => (
				React.createElement(QueryClientProvider, { client: queryClient }, children)
		);
};

describe('useDashboardData', () => {
		beforeEach(() => {
				vi.clearAllMocks();
		});

		it('returns empty/null data when not authenticated', () => {
				vi.mocked(useBalance).mockReturnValue({ balance: null, loading: false, refresh: async () => {} });

				const { result } = renderHook(() => useDashboardData({ isAuthenticated: false }), {
						wrapper: createWrapper()
				});

				expect(result.current.balance).toBeNull();
				expect(result.current.apiKeys).toEqual([]);
				expect(result.current.usage).toEqual([]);
				expect(result.current.creditBatches).toEqual([]);
				expect(result.current.models).toEqual([]);
				expect(result.current.transactions).toEqual([]);
				expect(result.current.loading).toBe(false);
				expect(result.current.error).toBeNull();
				expect(result.current.backendUnavailable).toBe(false);

				// None of the API endpoints should be called
				expect(api.auth.listKeys).not.toHaveBeenCalled();
				expect(api.usage.get).not.toHaveBeenCalled();
				expect(api.credits.getBatches).not.toHaveBeenCalled();
				expect(api.models.list).not.toHaveBeenCalled();
				expect(api.creditHistory.list).not.toHaveBeenCalled();
		});

		it('loads data successfully when authenticated', async () => {
				const mockBalance = { available: 100, currency: 'USD' };
				const mockKeys = [{ id: '1', key: 'sk-1' }];
				const mockUsage = [{ id: 'u1', cost: 0.05 }];
				const mockBatches = [{ id: 'b1', amount: 10 }];
				const mockModels = [{ id: 'm1', name: 'GPT-4' }];
				const mockTransactions = [{ id: 't1', amount: 10 }];

				vi.mocked(useBalance).mockReturnValue({ balance: mockBalance as any, loading: false, refresh: async () => {} });
				vi.mocked(api.auth.listKeys).mockResolvedValue({ keys: mockKeys } as any);
				vi.mocked(api.usage.get).mockResolvedValue({ records: mockUsage } as any);
				vi.mocked(api.credits.getBatches).mockResolvedValue({ activeBatches: mockBatches } as any);
				vi.mocked(api.models.list).mockResolvedValue({ data: mockModels } as any);
				vi.mocked(api.creditHistory.list).mockResolvedValue({ transactions: mockTransactions } as any);

				const { result } = renderHook(() => useDashboardData({ isAuthenticated: true }), {
						wrapper: createWrapper()
				});

				expect(result.current.loading).toBe(true);

				await waitFor(() => {
						expect(result.current.loading).toBe(false);
				});

				expect(result.current.balance).toEqual(mockBalance);
				expect(result.current.apiKeys).toEqual(mockKeys);
				expect(result.current.usage).toEqual(mockUsage);
				expect(result.current.creditBatches).toEqual(mockBatches);
				expect(result.current.models).toEqual(mockModels);
				expect(result.current.transactions).toEqual(mockTransactions);
				expect(result.current.error).toBeNull();
				expect(result.current.backendUnavailable).toBe(false);
		});

		it('handles standard errors', async () => {
				vi.mocked(useBalance).mockReturnValue({ balance: null, loading: false, refresh: async () => {} });
				vi.mocked(api.auth.listKeys).mockRejectedValue(new Error('Network error'));
				
				// Default resolve for others so they don't throw uncaught promises
				vi.mocked(api.usage.get).mockResolvedValue({ records: [] } as any);
				vi.mocked(api.credits.getBatches).mockResolvedValue({ activeBatches: [] } as any);
				vi.mocked(api.models.list).mockResolvedValue({ data: [] } as any);
				vi.mocked(api.creditHistory.list).mockResolvedValue({ transactions: [] } as any);

				const { result } = renderHook(() => useDashboardData({ isAuthenticated: true }), {
						wrapper: createWrapper()
				});

				await waitFor(() => {
						expect(result.current.loading).toBe(false);
				});

				expect(result.current.error).toBe('Network error');
				expect(result.current.backendUnavailable).toBe(false);
		});

		it('detects backend unavailable errors', async () => {
				vi.mocked(useBalance).mockReturnValue({ balance: null, loading: false, refresh: async () => {} });
				vi.mocked(api.auth.listKeys).mockRejectedValue(new BackendUnavailableError());
				
				// Default resolve for others
				vi.mocked(api.usage.get).mockResolvedValue({ records: [] } as any);
				vi.mocked(api.credits.getBatches).mockResolvedValue({ activeBatches: [] } as any);
				vi.mocked(api.models.list).mockResolvedValue({ data: [] } as any);
				vi.mocked(api.creditHistory.list).mockResolvedValue({ transactions: [] } as any);

				const { result } = renderHook(() => useDashboardData({ isAuthenticated: true }), {
						wrapper: createWrapper()
				});

				await waitFor(() => {
						expect(result.current.loading).toBe(false);
				});

				expect(result.current.backendUnavailable).toBe(true);
				// When backend unavailable is true, error is set to null (handled via top level UI)
				expect(result.current.error).toBeNull();
		});
		
		it('provides a working refresh function', async () => {
				vi.mocked(useBalance).mockReturnValue({ balance: null, loading: false, refresh: async () => {} });
				vi.mocked(api.auth.listKeys).mockResolvedValue({ keys: [] } as any);
				vi.mocked(api.usage.get).mockResolvedValue({ records: [] } as any);
				vi.mocked(api.credits.getBatches).mockResolvedValue({ activeBatches: [] } as any);
				vi.mocked(api.models.list).mockResolvedValue({ data: [] } as any);
				vi.mocked(api.creditHistory.list).mockResolvedValue({ transactions: [] } as any);

				const { result } = renderHook(() => useDashboardData({ isAuthenticated: true }), {
						wrapper: createWrapper()
				});

				await waitFor(() => {
						expect(result.current.loading).toBe(false);
				});

				// Clear call counts
				vi.clearAllMocks();

				await result.current.refresh();
				
				// Invalidate queries will trigger refetch for active queries
				// They are triggered async, so we'll wait for the mock to be called
				await waitFor(() => {
							expect(api.auth.listKeys).toHaveBeenCalled();
				});
		});
});
