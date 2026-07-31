"use client";

/**
 * x402Banner — agent-native pay-per-request path.
 */

import { ArrowRight, Bot, CreditCard } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Reveal } from "@/app/_components/home/reveal";

// BorderBeam ships a useState initializer that reads
// `window.matchMedia("(prefers-color-scheme: dark)")` — server picks
// "light", client picks "dark", the rendered keyframes diverge, and
// React throws a hydration mismatch. Loading it client-only avoids
// the SSR render entirely (the beam is decoration; not worth a
// hydration error).
const BorderBeam = dynamic(
	() => import("border-beam").then((mod) => mod.BorderBeam),
	{ ssr: false },
);

export function X402Banner() {
	return (
		<section
			aria-labelledby="x402-headline"
			className="relative py-16 sm:py-20"
		>
			<div className="container-page">
				<Reveal>
					<div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_10%,var(--color-panel)),var(--color-panel)_55%,var(--color-panel))] p-8 sm:p-10 lg:p-12">
						<BorderBeam size="sm" duration={6} theme="auto" className="pointer-events-none rounded-2xl">
							<div className="h-full w-full" />
						</BorderBeam>
						<div
							aria-hidden="true"
							className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
						/>
						<div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
							<div>
								<span className="badge mb-5">
									<Bot className="h-3 w-3" aria-hidden="true" />
									x402 · agent billing
								</span>
								<h2
									id="x402-headline"
									className="h2-section max-w-xl text-text-bright"
									style={{ textWrap: "balance" }}
								>
									Agents pay for themselves.
								</h2>
								<p className="mt-4 max-w-lg text-base leading-relaxed text-text-secondary">
									No card. No KYC. No subscriptions. On 402, read{" "}
									<code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-accent">
										PAYMENT-REQUIRED
									</code>
									, sign USDC on Base (EIP-3009, gasless), retry with{" "}
									<code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-accent">
										PAYMENT-SIGNATURE
									</code>{" "}
									— the gateway verifies, settles on-chain, and returns the
									completion.
								</p>
								<div className="mt-7 flex flex-wrap gap-3">
									<Link
										href="/docs#x402"
										className="btn-primary inline-flex h-11 items-center gap-2 px-5 text-sm"
									>
										x402 docs
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
									<Link
										href="/pricing"
										className="btn-secondary inline-flex h-11 items-center gap-2 px-4 text-sm"
									>
										<CreditCard className="h-4 w-4" aria-hidden="true" />
										See rates
									</Link>
								</div>
							</div>

							<div className="rounded-xl border border-border bg-void/60 p-5 font-mono text-[12px] leading-relaxed text-text-secondary sm:text-[13px]">
								<p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-text-muted">
									request shape
								</p>
								<pre className="overflow-x-auto whitespace-pre">
									{`POST /v1/chat/completions
PAYMENT-SIGNATURE: {"signature":"0x…","payload":{…}}
Content-Type: application/json

{ "model": "llama-3.3-70b",
  "messages": [...] }`}
								</pre>
							</div>
						</div>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
