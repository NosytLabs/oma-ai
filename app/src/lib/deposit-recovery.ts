/** Recovery metadata only. Ownership and crediting are verified by the API. */
export interface BroadcastDeposit {
	amountUsd: number;
	txHash: string;
	fromAddress: `0x${string}`;
	depositAddress: string;
}

const key = (userId: string) => `oma.deposit.pending.${userId}`;
const listeners = new Map<string, Set<() => void>>();
const operations = new Set<string>();
// Populated only by a failed storage mutation. Successful saves remove the
// fallback, so normal storage reads cannot be shadowed by old memory state.
const failedStorageWrites = new Map<string, BroadcastDeposit | null>();

function notify(userId: string): void {
	for (const listener of listeners.get(userId) ?? []) listener();
}

/** Same-tab subscribers also see transfers saved by a previously mounted panel. */
export function subscribePendingDeposit(userId: string, listener: () => void): () => void {
	const accountListeners = listeners.get(userId) ?? new Set<() => void>();
	listeners.set(userId, accountListeners);
	accountListeners.add(listener);
	return () => {
		accountListeners.delete(listener);
		if (!accountListeners.size) listeners.delete(userId);
	};
}

export function depositOperationPending(userId: string): boolean {
	return operations.has(userId);
}

/** A remount must not open a second prompt while the original is unresolved. */
export function beginDepositOperation(userId: string): boolean {
	if (operations.has(userId)) return false;
	operations.add(userId);
	notify(userId);
	return true;
}

export function endDepositOperation(userId: string): void {
	operations.delete(userId);
	notify(userId);
}

export function readPendingDeposit(userId: string): BroadcastDeposit | null {
	if (failedStorageWrites.has(userId)) return failedStorageWrites.get(userId) ?? null;
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
		failedStorageWrites.delete(userId);
	} catch {
		// Keep the latest failed mutation, including clears, for this loaded tab.
		failedStorageWrites.set(userId, transfer);
	}
	notify(userId);
}
