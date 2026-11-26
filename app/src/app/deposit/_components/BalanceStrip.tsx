"use client";

/**
 * BalanceStrip — the deposit page's balance line (2026-11 revamp
 * wireframe: "Balance 2,500 cr · $25.00 equiv", mono). New chrome over
 * the existing GET /v1/balance data. Renders nothing until a balance
 * actually loads — signed-out visitors and failed reads simply get no
 * strip rather than a wrong number.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function BalanceStrip() {
	const [balanceCents, setBalanceCents] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		api.balance
			.get()
			.then((b) => {
				const cents = Number.parseFloat(b.balanceCents ?? "");
				if (!cancelled && Number.isFinite(cents)) setBalanceCents(cents);
			})
			.catch(() => {
				// No strip when the balance cannot be read.
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (balanceCents === null) return null;

	// Balance is stored in cents; 1 credit = $0.01, so the credit count
	// equals the cent count and the dollar figure is cents / 100.
	const credits = Math.round(balanceCents);
	const dollars = (balanceCents / 100).toFixed(2);

	return (
		<p className="ledger-figures mb-8 border-y border-border py-3 font-mono text-[13px] text-text-secondary">
			Balance{" "}
			<span className="text-text-bright">
				{credits.toLocaleString("en-US")} cr
			</span>{" "}
			· ${dollars} equiv
		</p>
	);
}
