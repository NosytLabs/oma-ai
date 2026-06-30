"use client";

const TRUST = [
	{ label: "Venice AI", hint: "Zero-log inference" },
	{ label: "USDC", hint: "Stable pricing" },
	{ label: "Base", hint: "Settlement" },
	{ label: "x402", hint: "Pay-per-request" },
	{ label: "OpenAI-compatible", hint: "Drop-in" },
	{ label: "No KYC", hint: "Anonymous" },
] as const;

export function TrustBar() {
	return (
		<section className="border-b border-border">
			<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
				<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-text-tertiary font-mono">
					{TRUST.map((t, i) => (
						<span key={t.label} className="inline-flex items-center gap-1.5">
							<span className="text-text-bright">{t.label}</span>
							<span className="hidden sm:inline text-text-muted">{t.hint}</span>
							{i < TRUST.length - 1 && (
								<span
									className="text-text-tertiary/40 hidden lg:inline ml-4"
									aria-hidden="true"
								>
									/
								</span>
							)}
						</span>
					))}
				</div>
			</div>
		</section>
	);
}
