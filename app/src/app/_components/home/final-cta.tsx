"use client";

/**
 * FinalCTA — section 8 of the homepage (last before footer).
 * Asymmetric: large left headline + single primary CTA right.
 */

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
	return (
		<section
			aria-labelledby="final-cta-headline"
			className="relative border-t border-border-subtle py-16 sm:py-20"
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
								Free tier, no card, no email. Your first request lands in under
								a minute.
							</p>
						</div>

						<div className="flex flex-col gap-3 lg:items-end">
							<Button
								asChild
								size="lg"
								rightIcon={<ArrowRight className="h-4 w-4" />}
								className="self-start lg:self-end px-7 h-14 text-base"
							>
								<Link href="/login">Get your API key</Link>
							</Button>
							<div className="text-xs text-text-muted font-mono lg:text-right">
								Or{" "}
								<Link
									href="/docs"
									className="text-accent hover:text-accent-hover underline-offset-4 hover:underline"
								>
									read the docs
								</Link>{" "}
								first — we don&apos;t mind.
							</div>
						</div>
					</div>
				</Reveal>
			</div>
		</section>
	);
}