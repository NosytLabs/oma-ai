"use client";

import { m } from "@/lib/framer-motion-client";
import { Coins } from "lucide-react";
import { blurIn } from "@/lib/animation";

export function UnifiedDepositHeader() {
	return (
		<m.div
			className="mb-8"
			variants={blurIn}
			initial="hidden"
			animate="show"
		>
			<div className="mb-3 flex flex-wrap items-start gap-3 sm:items-center sm:gap-4">
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-border-bright bg-surface">
					<Coins className="h-6 w-6 text-accent" aria-hidden="true" />
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="h1-utility text-text-bright">Add credits</h1>
					<p className="text-sm text-text-secondary">
						Fund your prepaid API balance. Choose an available payment method below.
					</p>
				</div>
			</div>
		</m.div>
	);
}
