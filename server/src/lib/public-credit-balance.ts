/** Present ledger debt without changing the internal balance used for admission. */
export function publicCreditBalance(balanceCents: string = "0"): {
	balanceCents: string;
	debtCents?: string;
} {
	if (!balanceCents.startsWith("-")) return { balanceCents };
	const debtCents = balanceCents.slice(1);
	// PostgreSQL numeric values arrive as decimal strings. Inspect their digits
	// directly so sub-cent debt and large balances never round through Number.
	return /[1-9]/.test(debtCents)
		? { balanceCents: "0", debtCents }
		: { balanceCents: "0" };
}
