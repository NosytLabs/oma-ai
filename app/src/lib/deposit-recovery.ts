/** Recovery metadata only. Ownership and crediting are verified by the API. */
export interface BroadcastDeposit {
	amountUsd: number;
	txHash: string;
	fromAddress: `0x${string}`;
	depositAddress: string;
}

const key = (userId: string) => `oma.deposit.pending.${userId}`;

export function readPendingDeposit(userId: string): BroadcastDeposit | null {
	try {
		const value = JSON.parse(sessionStorage.getItem(key(userId)) ?? "null");
		if (!value || typeof value !== "object" || !Number.isFinite(value.amountUsd) || value.amountUsd <= 0 || value.amountUsd > 10_000
			|| typeof value.txHash !== "string" || !/^0x[\da-f]{64}$/i.test(value.txHash)
			|| typeof value.fromAddress !== "string" || !/^0x[\da-f]{40}$/i.test(value.fromAddress)
			|| typeof value.depositAddress !== "string" || !/^0x[\da-f]{40}$/i.test(value.depositAddress)) return null;
		return { amountUsd: value.amountUsd, txHash: value.txHash, fromAddress: value.fromAddress, depositAddress: value.depositAddress };
	} catch { return null; }
}

export function savePendingDeposit(userId: string, transfer: BroadcastDeposit | null): void {
	try {
		if (transfer) sessionStorage.setItem(key(userId), JSON.stringify(transfer));
		else sessionStorage.removeItem(key(userId));
	} catch {
		// In-memory recovery and the explorer link still work if storage is blocked.
	}
}
