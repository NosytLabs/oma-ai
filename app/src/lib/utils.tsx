export function formatCents(cents: string | number): string {
	const n = typeof cents === "string" ? parseFloat(cents) : cents;
	return (n / 100).toFixed(2);
}

/**
 * Convert a cents value (string from API or number) to a dollar number.
 * Centralizes the `parseFloat(String(x)) / 100` pattern that was duplicated
 * across 9+ components. Returns 0 for null/undefined/non-finite input.
 */
export function toDollars(cents: string | number | null | undefined): number {
	if (cents == null) return 0;
	const n = typeof cents === "string" ? parseFloat(cents) : cents;
	if (!Number.isFinite(n)) return 0;
	return n / 100;
}

/**
 * Single source of truth for "X minutes ago" / "X hours ago" formatting.
 * Replaces the three inline copies that previously lived in
 * `RecentTransactions.tsx`, `ProviderHealthCard.tsx`, and the original
 * `formatTime` here. Returns the locale date string for anything older
 * than 30 days.
 */
export function formatTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 30) return `${diffDay}d ago`;
	return d.toLocaleDateString();
}

export function maskKey(prefix: string | null | undefined): string {
	// Server historically returned `keyPrefix`; listKeys normalizes to `prefix`.
	// Guard so stale cache / partial objects never render as "undefined****".
	if (!prefix) return "••••****";
	return `${prefix}****`;
}

/**
 * Format a USD amount with a `$` prefix and fixed decimals.
 */
export function formatUsd(amount: number, decimals = 2): string {
	return `$${amount.toFixed(decimals)}`;
}

/**
 * Shorten an EVM address for table display.
 * Examples:
 *   "0x1234567890abcdef1234567890abcdef12345678" → "0x1234…5678"
 *   "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpniT33q5op" → "9xQe…5op"
 *
 * Returns the original string if it is shorter than the threshold so we
 * don't mangle short identifiers.
 */
export function formatAddress(addr: string | null | undefined): string {
	if (!addr) return "—";
	if (addr.length <= 14) return addr;
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Format an ISO date string with date and time.
 * "2026-01-15T10:30:00Z" → "Jan 15, 2026, 10:30 AM"
 */
export function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Format an ISO date string with date only (no time).
 * "2026-01-15T10:30:00Z" → "Jan 15, 2026"
 */
export function formatDateShort(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

