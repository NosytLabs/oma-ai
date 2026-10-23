import Link from "next/link";

/** Spendable balance already excludes these amounts. Never add them to it. */
export function PendingCredits({
	reservedCents,
	reconciliationCents,
}: {
	reservedCents?: string;
	reconciliationCents?: string;
}) {
	const reserved = Number(reservedCents ?? 0);
	const review = Number(reconciliationCents ?? 0);
	if (!(reserved > 0) && !(review > 0)) return null;
	const format = (value: number) =>
		value.toLocaleString(undefined, { maximumFractionDigits: 8 });
	return (
		<div className="mb-4 space-y-2 rounded-lg border border-border p-3 text-xs text-text-secondary">
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
