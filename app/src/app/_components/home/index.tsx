"use client";

/**
 * HomeView — homepage client root.
 * Renders all 8 sections in flow order. Each section is its own client
 * component with viewport-driven entrance motion.
 */

import { CapabilitiesGrid } from "@/app/_components/home/capabilities-grid";
import { CodeExample } from "@/app/_components/home/code-example";
import { FinalCTA } from "@/app/_components/home/final-cta";
import { Hero } from "@/app/_components/home/hero";
import { HowItWorks } from "@/app/_components/home/how-it-works";
import { Stats } from "@/app/_components/home/stats";
import { TrustStrip } from "@/app/_components/home/trust-strip";
import { X402Banner } from "@/app/_components/home/x402-banner";

export interface HomeViewProps {
	modelCount: number;
}

export function HomeView({ modelCount }: HomeViewProps) {
	return (
		<div className="flex flex-col">
			<Hero modelCount={modelCount} />
			<TrustStrip />
			<CapabilitiesGrid />
			<HowItWorks />
			<CodeExample modelCount={modelCount} />
			<Stats modelCount={modelCount} />
			<X402Banner />
			<FinalCTA />
		</div>
	);
}