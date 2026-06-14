import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../index.js';
import { validateApiKey } from '../auth/api-keys.js';
import { getBalance, deductCredits } from '../credits/index.js';
import { trackSpend } from '../middleware/spend-limit.js';
import { scheduleCreditExpiry } from '../jobs/credit-expiry.js';
import { scheduleSubscriptionCheck } from '../jobs/subscription-cron.js';
import { scheduleNonceCleanup } from '../jobs/nonce-cleanup.js';

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}));

vi.mock('../jobs/credit-expiry.js', () => ({
  scheduleCreditExpiry: vi.fn(),
  processExpiredCredits: vi.fn(),
}));

vi.mock('../jobs/subscription-cron.js', () => ({
  scheduleSubscriptionCheck: vi.fn(),
  processExpiredSubscriptions: vi.fn(),
}));

vi.mock('../jobs/nonce-cleanup.js', () => ({
  scheduleNonceCleanup: vi.fn(),
  stopNonceCleanup: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: {
    PORT: 3001,
    DATABASE_URL: 'postgres://localhost/test',
    JWT_SECRET: 'testsecret',
    RECEIPT_HMAC_SECRET: 'testsecret',
    NODE_ENV: 'test',
    SPEND_LIMIT_DAILY_CENTS: 1000,
    TINYFISH_API_KEY: 'testkey',
  }
}));

vi.mock('../db/client.js', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'dep-1' }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return { db: chain, getDb: () => chain };
});

vi.mock('../auth/api-keys.js', () => ({ shouldRecommendRotation: vi.fn().mockReturnValue(false), 
  validateApiKey: vi.fn(),
}));

vi.mock('../auth/siwe.js', () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock('../credits/index.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  deductCredits: vi.fn(),
}));

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
  tokenBucket: () => async (_c: unknown, next: () => void) => next(),
  modelRateLimit: () => async (_c: unknown, next: () => void) => next(),
  expressiveRateLimit: () => async (_c: unknown, next: () => void) => next(),
}));

vi.mock('../middleware/spend-limit.js', () => ({
  spendLimit: () => async (_c: unknown, next: () => void) => next(),
  trackSpend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../inference/tinyfish.js', () => ({
  searchWeb: vi.fn().mockResolvedValue({
    query: "test",
    results: [],
    total_results: 0,
    page: 1
  }),
}));

describe('Server bootstrap', () => {
  it('does not start background jobs during tests', () => {
    expect(scheduleCreditExpiry).not.toHaveBeenCalled();
    expect(scheduleSubscriptionCheck).not.toHaveBeenCalled();
    expect(scheduleNonceCleanup).not.toHaveBeenCalled();
  });
});

describe('Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deducts credits and tracks spend on successful search', async () => {
    vi.mocked(validateApiKey).mockResolvedValueOnce({
      id: 'key-1', userId: 'user-1', keyPrefix: 'oma_sk_abc', keyHash: 'hash', name: 'test', active: true, lastUsedAt: null, expiresAt: null, ipAllowlist: null, createdAt: new Date(),
    });

    const res = await app.request('/v1/search?query=test', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer oma_sk_validkey',
      },
    });

    expect(res.status).toBe(200);
    
    // Check if spend was tracked
    expect(trackSpend).toHaveBeenCalled();
    // Check if credits were deducted
    expect(deductCredits).toHaveBeenCalled();
  });

  it('rejects if insufficient credits', async () => {
    vi.mocked(validateApiKey).mockResolvedValueOnce({
      id: 'key-1', userId: 'user-1', keyPrefix: 'oma_sk_abc', keyHash: 'hash', name: 'test', active: true, lastUsedAt: null, expiresAt: null, ipAllowlist: null, createdAt: new Date(),
    });
    vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '0', totalDepositedCents: '0', totalUsedCents: '0', lastActivityAt: null });

    const res = await app.request('/v1/search?query=test', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer oma_sk_validkey',
      },
    });

    expect(res.status).toBe(402);
  });
});
