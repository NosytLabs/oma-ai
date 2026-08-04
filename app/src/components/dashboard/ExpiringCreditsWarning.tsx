"use client";

import { m } from "@/lib/framer-motion-client";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { CreditBatch } from "@/lib/api";
import { toDollars } from "@/lib/utils";

interface ExpiringCreditsWarningProps {
	creditBatches: CreditBatch[];
}

export function ExpiringCreditsWarning({
	creditBatches,
}: ExpiringCreditsWarningProps) {
	const now = new Date();
	const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const expiringBatches = creditBatches.filter((b) => {
		const expDate = new Date(b.expiresAt);
		return expDate <= thirtyDaysFromNow && expDate > now;
	});

	if (expiringBatches.length === 0) return null;

	return (
		<m.div
			role="status"
			className="flex flex-col gap-2 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 sm:flex-row sm:items-center"
			initial={{ opacity: 0, y: -4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
		>
			<div className="flex items-start gap-3 sm:items-center sm:flex-1">
				<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-secondary/30 bg-secondary/10 text-secondary">
					<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
				</div>
				<div className="flex-1">
					<h3 className="text-sm font-semibold text-secondary">
						Credits expiring soon
					</h3>
					<div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
						{expiringBatches.map((batch) => {
							const expDate = new Date(batch.expiresAt);
							const daysLeft = Math.ceil(
								(expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
							);
							return (
								<span key={batch.id} className="flex items-center gap-1.5">
									<span className="font-mono">
										${toDollars(batch.remainingCents).toFixed(2)}
									</span>
									<span className="text-text-muted">·</span>
									<span className="text-secondary">
										{daysLeft === 0
											? "today"
											: daysLeft === 1
												? "tomorrow"
												: `in ${daysLeft} days`}
									</span>
								</span>
							);
						})}
					</div>
				</div>
			</div>
			<Link
				href="/deposit"
				className="self-end inline-flex items-center gap-1 rounded-md border border-secondary/30 bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-secondary/20 sm:self-auto"
			>
				Top up →
			</Link>
		</m.div>
	);
}
