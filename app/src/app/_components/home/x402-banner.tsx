"use client";

/**
 * X402Banner — section 7 of the homepage.
 * Full-width accent-tinted banner. The ONE eyebrow reserved for this page.
 */

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

export function X402Banner() {
	return (
		<section
			aria-labelledby="x402-headline"
			className="relative py-24 sm:py-32"
		>
			<div className="container-page">
				<Reveal>
					<div
						className={cn(
							"surface-accent relative overflow-hidden",
							"rounded-[var(--radius-lg)]",
							"px-6 py-12 sm:px-12 sm:py-16 lg:px-16",
						)}
					>
						<div
							className="absolute inset-0 opacity-30 pointer-events-none"
							style={{
								backgroundImage:
									"radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-accent) 30%, transparent) 1px, transparent 0)",
								backgroundSize: "32px 32px",
								maskImage:
									"radial-gradient(ellipse at 50% 50%, black, transparent 70%)",
							}}
							aria-hidden="true"
						/>

						<div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center">
							<div className="flex flex-col gap-5">
								<span className="eyebrow">x402 Protocol</span>
								<h2
									id="x402-headline"
									className="section-headline text-text-bright text-balance"
								>
									Agents pay for themselves.
									<br />
									<span className="gradient-text-accent">
										No accounts. No subscriptions.
									</span>
								</h2>
								<p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
									OMA speaks the x402 protocol natively. Your agent sends a
									request, gets a 402, signs a USDC micropayment on Base, and
									gets the response — all in one round trip. Settled in seconds,
									no human in the loop.
								</p>
							</div>

							<div className="flex flex-col gap-4 lg:items-end">
								<Button
									asChild
									size="lg"
									rightIcon={<ArrowRight className="h-4 w-4" />}
									className="self-start lg:self-end"
								>
									<Link href="/docs">Read the docs</Link>
								</Button>
								<div className="text-xs text-text-muted font-mono lg:text-right">
									Compatible with Coinbase x402 SDK · PayAI · thirdweb
								</div>
							</div>
						</div>
					</div>
				</Reveal>
			</div>
		</section>
	);
}