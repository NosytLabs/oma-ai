import Link from "next/link";

/** Spendable balance already excludes these amounts. Never add them to it. */
export function PendingCredits({
	reservedCents,
	reconciliationCents,
	debtCents,
}: {
	reservedCents?: string;
	reconciliationCents?: string;
	debtCents?: string;
}) {
	const reserved = Number(reservedCents ?? 0);
	const review = Number(reconciliationCents ?? 0);
	const hasDebt = /^[0-9]+(?:\.[0-9]+)?$/.test(debtCents ?? "") && /[1-9]/.test(debtCents ?? "");
	if (!(reserved > 0) && !(review > 0) && !hasDebt) return null;
	const format = (value: number) =>
		value.toLocaleString(undefined, { maximumFractionDigits: 8 });
	return (
		<div className="mb-4 space-y-2 rounded-lg border border-border p-3 text-xs text-text-secondary">
			{hasDebt && (
				<p>
					Credit shortfall: {debtCents} credits after a refund adjustment.
					Future top-ups first offset this shortfall before credits become
					available to spend.{" "}
					<Link href="/deposit" className="text-accent underline">
						Top up credits
					</Link>
				</p>
			)}
			{reserved > 0 && (
				<p>
					{format(reserved)} credits reserved for pending requests. Unused
					credits return after the request cost is confirmed.
				</p>
			)}
			{review > 0 && (
				<p>
					{format(review)} credits need a cost review after an interrupted
					request. These credits are unavailable until the review is complete.{" "}
					<Link href="/contact" className="text-accent underline">
						Contact support
					</Link>{" "}
					with the request ID.
				</p>
			)}
		</div>
	);
}
