"use client";

/**
 * FinalCTA — section 8 of the homepage (last before footer).
 * Asymmetric: large left headline + single primary CTA right.
 */

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";
import { ElectricBorder } from "@/components/electric-border";

export function FinalCTA() {
	return (
		<section
			aria-labelledby="final-cta-headline"
			className="relative border-t border-border-subtle py-12 sm:py-16"
		>
			<div className="container-page">
				<Reveal>
					<div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
						<div className="flex flex-col gap-4">
							<h2
								id="final-cta-headline"
								className="display-headline text-text-bright"
							>
								Stop renting GPUs.
								<br />
								<span className="gradient-text-accent">
									Start shipping agents.
								</span>
							</h2>
							<p className="text-lg text-text-secondary max-w-xl leading-relaxed">
								Wallet or account number, credits in USDC on Base, one
								OpenAI-compatible API. First call in under a minute.
							</p>
						</div>

						<div className="flex flex-col gap-3 lg:items-end">
							<div className="flex flex-wrap items-center gap-3 self-start lg:self-end">
<ElectricBorder
					borderRadius="9999px"
					borderWidth={1}
					color="var(--color-accent)"
					className="electric-border-host"
					style={{ animationDuration: "3s" }}
								>
									<Link
										href="/login"
										className="btn-primary inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px]"
									>
										Get API key
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
								</ElectricBorder>
								<Link
									href="/login?method=account"
									className="btn-secondary inline-flex min-h-12 items-center gap-2 px-5 text-[14px]"
								>
									Account number
								</Link>
							</div>
							<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted font-mono lg:justify-end">
								<Link
									href="/docs"
									className="text-accent hover:text-accent-hover underline-offset-4 hover:underline"
								>
									docs
								</Link>
								<span className="text-text-tertiary" aria-hidden="true">
									·
								</span>
								<Link
									href="/chat"
									className="hover:text-text-bright underline-offset-4 hover:underline"
								>
									playground
								</Link>
								<span className="text-text-tertiary" aria-hidden="true">
									·
								</span>
								<Link
									href="/pricing"
									className="hover:text-text-bright underline-offset-4 hover:underline"
								>
									pricing
								</Link>
							</div>
						</div>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
