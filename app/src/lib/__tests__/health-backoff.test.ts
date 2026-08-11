import { describe, it, expect, beforeEach } from 'vitest';
import { recordHealthCheckResult, nextHealthPollMs } from '../health-backoff';

describe('health-backoff', () => {
    beforeEach(() => {
        // Reset to initial state (success) before each test
        recordHealthCheckResult(true);
    });

    it('returns steady 30s interval when healthy', () => {
        expect(nextHealthPollMs()).toBe(30_000);
    });

    it('backs off exponentially when failing', () => {
        recordHealthCheckResult(false);
        expect(nextHealthPollMs()).toBe(5_000); // 1 failure

        recordHealthCheckResult(false);
        expect(nextHealthPollMs()).toBe(10_000); // 2 failures

        recordHealthCheckResult(false);
        expect(nextHealthPollMs()).toBe(20_000); // 3 failures

        recordHealthCheckResult(false);
        expect(nextHealthPollMs()).toBe(40_000); // 4 failures
    });

    it('caps at 60s max interval', () => {
        // 5 failures would be 80s without cap
        for (let i = 0; i < 5; i++) recordHealthCheckResult(false);
        expect(nextHealthPollMs()).toBe(60_000);

        // 10 failures
        for (let i = 0; i < 5; i++) recordHealthCheckResult(false);
        expect(nextHealthPollMs()).toBe(60_000);
    });

    it('resets to 30s upon success', () => {
        for (let i = 0; i < 5; i++) recordHealthCheckResult(false);
        expect(nextHealthPollMs()).toBe(60_000);

        recordHealthCheckResult(true);
        expect(nextHealthPollMs()).toBe(30_000);
    });
});
