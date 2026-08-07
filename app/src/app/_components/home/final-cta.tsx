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
 className="relative overflow-hidden border-t border-border-subtle py-16 sm:py-20"
 >
 <div
 aria-hidden="true"
 className="pointer-events-none absolute inset-0 -z-10"
 >
 <div className="absolute inset-0 bg-grid opacity-[0.12] mask-radial" />
 <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.06] blur-[120px]" />
 </div>
 <div className="container-page">
 <Reveal>
 <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-[1.45fr_1fr] lg:gap-14">
 <div className="flex flex-col gap-5">
 <p className="eyebrow text-text-muted">Open the gateway</p>
 <h2
 id="final-cta-headline"
 className="display-headline max-w-[14ch] text-text-bright"
 >
 Get an API key.
 <br />
 <span className="gradient-text-accent">Call any model.</span>
 </h2>
 <p className="max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
 Fund credits with card (Polar) or USDC on Base. Use x402 when
 agents need to pay per request. One OpenAI-compatible surface.
 </p>
 </div>

 <div className="flex flex-col gap-4 lg:items-end">
 <div className="flex flex-wrap items-center gap-3 self-start lg:self-end">
 <ElectricBorder
 borderRadius="9999px"
 borderWidth={1}
 color="var(--color-accent)"
 className="electric-border-host !rounded-full transition-[transform] duration-200 ease-out hover:scale-[1.01] active:scale-[0.97] "
 style={{ animationDuration: "3s" }}
 >
						<Link
							href="/login"
							className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-8 font-mono text-sm font-bold text-void transition-[background-color,transform] duration-200 ease-out active:scale-[0.97] hover:bg-accent-bright focus-ring"
						>
 Get API key
 <ArrowRight className="h-4 w-4" aria-hidden="true" />
 </Link>
 </ElectricBorder>
						<Link
							href="/pricing"
							className="inline-flex h-11 items-center justify-center rounded-md border border-border-hi bg-surface px-8 font-mono text-sm font-medium text-text-primary transition-[border-color,transform] duration-200 ease-out active:scale-[0.97] hover:border-accent/50 focus-ring"
						>
 View pricing
 </Link>
 </div>
 <nav
 aria-label="Quick links"
 className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-text-muted lg:justify-end"
 >
 <Link
 href="/docs"
 className="text-accent underline-offset-4 hover:text-accent-hover hover:underline"
 >
 docs
 </Link>
 <span className="text-text-tertiary" aria-hidden="true">
 ·
 </span>
 <Link
 href="/chat"
 className="underline-offset-4 hover:text-text-bright hover:underline"
 >
 playground
 </Link>
 <span className="text-text-tertiary" aria-hidden="true">
 ·
 </span>
 <Link
 href="/pricing"
 className="underline-offset-4 hover:text-text-bright hover:underline"
 >
 pricing
 </Link>
 </nav>
 </div>
 </div>
 </Reveal>
 </div>
 </section>
 );
}
