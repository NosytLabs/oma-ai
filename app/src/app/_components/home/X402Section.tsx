"use client";

import { m } from "framer-motion";
import { ArrowRight, Globe } from "lucide-react";
import Link from "next/link";
import { FadeIn, fadeRightSafe, StaggerReveal } from "@/lib/motion";

const X402_STEPS = [
	{
		n: "01",
		t: "POST without payment",
		d: "No account, no API key, no auth header. Just an HTTP request to /v1/chat/completions.",
	},
	{
		n: "02",
		t: "Server returns 402",
		d: "OMA replies with HTTP 402 Payment Required and a Pay-Req header describing the price on Base.",
	},
	{
		n: "03",
		t: "Wallet signs USDC",
		d: "Your wallet signs an EIP-3009 transferWithAuthorization. No gas, no approval pop-up.",
	},
	{
		n: "04",
		t: "Retry with signature",
		d: "The retry includes PAYMENT-SIGNATURE. OMA verifies, settles on Base, and forwards the call.",
	},
	{
		n: "05",
		t: "Stream the answer",
		d: "The model response streams back. One round trip, one signature, one receipt.",
	},
] as const;

export function X402Section() {
	return (
		<section className="border-b border-border">
			<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
				<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12 items-start">
					<FadeIn>
						<h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight leading-tight">
							Pay per request.
							<br />
							<span className="text-accent">No balance, no signup.</span>
						</h2>
						<p className="mt-4 text-text-secondary text-sm sm:text-base max-w-md">
							x402 is an open standard for HTTP-native payments. The wallet
							signs a USDC transfer on Base, the receipt is verified, the
							upstream model is called. One round trip, one signature.
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							<Link
								href="/docs"
								className="btn-secondary inline-flex items-center gap-2"
							>
								<Globe className="h-3.5 w-3.5" aria-hidden="true" />
								Read the protocol
							</Link>
							<Link
								href="/chat"
								className="btn-primary inline-flex items-center gap-2"
							>
								Try it live
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
						</div>
					</FadeIn>

					<StaggerReveal stagger={0.08}>
						<ol className="border-gradient rounded-2xl divide-y divide-border overflow-hidden">
							{X402_STEPS.map((s) => (
								<m.li
									key={s.n}
									variants={fadeRightSafe}
									className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 px-5 py-4"
								>
									<span className="font-mono text-[11px] text-accent tabular-nums pt-0.5">
										{s.n}
									</span>
									<div className="min-w-0">
										<p className="text-sm font-medium text-text-bright mb-1">
											{s.t}
										</p>
										<p className="text-xs text-text-secondary leading-relaxed">
											{s.d}
										</p>
									</div>
								</m.li>
							))}
						</ol>
					</StaggerReveal>
				</div>
			</div>
		</section>
	);
}
