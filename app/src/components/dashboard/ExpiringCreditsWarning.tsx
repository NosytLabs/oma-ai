"use client";

import type { CreditBatch } from "@/lib/api";

interface ExpiringCreditsWarningProps {
	creditBatches: CreditBatch[];
}

/**
 * Credits never expire while the account is active.
 * Kept as a no-op so any leftover mount cannot contradict product copy.
 */
export function ExpiringCreditsWarning({
	creditBatches: _creditBatches,
}: ExpiringCreditsWarningProps) {
	void _creditBatches;
	return null;
}
