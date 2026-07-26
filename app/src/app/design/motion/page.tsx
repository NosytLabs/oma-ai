"use client";

import { useState } from "react";
import {
	Magnetic,
	SpringCard,
	ElasticCounter,
	TabPill,
	springs,
	easings,
} from "@/components/motion";

/**
 * /design/motion — internal motion reference page.
 *
 * Demonstrates each kinetics component end-to-end so the team can
 * (a) verify the library renders correctly in the OMA theme and
 * (b) copy-paste the exact patterns into product surfaces.
 *
 * Dev-only: returns 404 in production builds.
 */

const TABS = [
	{ id: "chat", label: "Chat" },
	{ id: "image", label: "Image" },
	{ id: "audio", label: "Audio" },
	{ id: "video", label: "Video" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MotionReferencePage() {
	const [count, setCount] = useState(12);
	const [tab, setTab] = useState<TabId>("chat");

	// Dev-only page — render nothing in production
	if (process.env.NODE_ENV === "production") {
		return null;
	}

	return (
		<main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
			<header>
				<h1 className="text-3xl font-semibold tracking-tight">Motion reference</h1>
				<p className="text-muted-foreground mt-2">
					Internal copy-paste board for kinetics-inspired motion. Every effect
					respects <code>prefers-reduced-motion</code> via the app-wide{" "}
					<code>MotionProvider</code>.
				</p>
			</header>

			{/* ── Magnetic button ─────────────────────────────── */}
			<section className="space-y-3">
				<h2 className="text-xl font-medium">Magnetic button</h2>
				<p className="text-sm text-muted-foreground">
					Spring-follows the cursor (max displacement in px), snaps back on
					leave. Renders static under reduced motion.
				</p>
				<div className="flex gap-4 items-center">
					<Magnetic>
						<button
							type="button"
							className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm font-medium"
						>
							Connect wallet
						</button>
					</Magnetic>
					<Magnetic strength={24}>
						<button
							type="button"
							className="rounded-md border border-border bg-card px-4 py-2 text-sm"
						>
							Stronger (24px)
						</button>
					</Magnetic>
				</div>
			</section>

			{/* ── Elastic counter ─────────────────────────────── */}
			<section className="space-y-3">
				<h2 className="text-xl font-medium">Elastic counter</h2>
				<p className="text-sm text-muted-foreground">
					Bumps with spring overshoot, settles cleanly under rapid clicks.
				</p>
				<ElasticCounter
					value={count}
					onClick={() => setCount((v) => v + 1)}
					className="rounded-lg border border-border bg-card px-6 py-3 text-3xl font-semibold tabular-nums"
					ariaLabel={`Increment counter, current value ${count}`}
				/>
			</section>

			{/* ── Tab pill ────────────────────────────────────── */}
			<section className="space-y-3">
				<h2 className="text-xl font-medium">Tab pill</h2>
				<p className="text-sm text-muted-foreground">
					Indicator measures target width and slides between tabs.
				</p>
				<TabPill tabs={[...TABS]} active={tab} onChange={(id) => setTab(id)} />
			</section>

			{/* ── Spring card ────────────────────────────────── */}
			<section className="space-y-3">
				<h2 className="text-xl font-medium">Spring card</h2>
				<p className="text-sm text-muted-foreground">
					Grid-rows trick — no JS height measurement, no layout thrash.
				</p>
				<SpringCard title="What is kinetics?">
					A library of interface animations built on spring physics instead
					of fixed-duration easing. Each effect ships with a stiffness /
					damping readout so you copy a tuned spring, not a guess.
				</SpringCard>
				<SpringCard title="Why two numbers instead of duration?">
					A duration has no idea where an interruption left it. A spring
					integrates from current velocity — no snap, no restart.
				</SpringCard>
			</section>

			{/* ── Spring table (so devs can copy values) ──────── */}
			<section className="space-y-3">
				<h2 className="text-xl font-medium">Spring tokens</h2>
				<table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
					<thead className="bg-muted/40">
						<tr>
							<th className="text-left px-3 py-2 font-medium">Name</th>
							<th className="text-left px-3 py-2 font-medium">Stiffness</th>
							<th className="text-left px-3 py-2 font-medium">Damping</th>
							<th className="text-left px-3 py-2 font-medium">Mass</th>
						</tr>
					</thead>
					<tbody>
						{(Object.entries(springs) as [keyof typeof springs, { stiffness: number; damping: number; mass?: number }][]).map(
							([name, t]) => (
								<tr key={name} className="border-t border-border/40">
									<td className="px-3 py-2 font-mono">{name}</td>
									<td className="px-3 py-2 tabular-nums">{t.stiffness}</td>
									<td className="px-3 py-2 tabular-nums">{t.damping}</td>
									<td className="px-3 py-2 tabular-nums">{t.mass ?? 1}</td>
								</tr>
							),
						)}
					</tbody>
				</table>
				<p className="text-xs text-muted-foreground mt-2">
					CSS easings (when you can&apos;t use framer-motion):{" "}
					<code>{easings.spring}</code>,{" "}
					<code>{easings.springTight}</code>,{" "}
					<code>{easings.springSoft}</code>,{" "}
					<code>{easings.easeOut}</code>
				</p>
			</section>
		</main>
	);
}
