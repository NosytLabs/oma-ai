"use client";

/**
 * NetworkStrip — section that highlights the new programmable primitives.
 *
 * Distinctive editorial surface: it shows a "live" pseudo-SVG of a network
 * topology with one node highlighted, paired with a copy block explaining
 * what changed. Lives between Stats and X402Banner in the homepage flow.
 *
 * The SVG is hand-built (no library) so it can lean on theme variables
 * and stay crisp at any size.
 */

import { ArrowRight, Network } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";

interface NodeSpec {
	id: string;
	x: number;
	y: number;
	label: string;
	kind: "oma" | "upstream" | "agent" | "chain";
}

const NODES: NodeSpec[] = [
	{ id: "agent", x: 80, y: 120, label: "AGENT", kind: "agent" },
	{ id: "oma", x: 320, y: 120, label: "OMA", kind: "oma" },
	{ id: "venice", x: 560, y: 60, label: "VENICE", kind: "upstream" },
	{ id: "antseed", x: 560, y: 140, label: "ANTSEED", kind: "upstream" },
	{ id: "openrouter", x: 560, y: 220, label: "OPENROUTER", kind: "upstream" },
	{ id: "base", x: 320, y: 260, label: "BASE", kind: "chain" },
];

const NODE_STYLE: Record<NodeSpec["kind"], { fill: string; stroke: string; text: string }> = {
	oma: {
		fill: "var(--color-accent-dim)",
		stroke: "var(--color-accent)",
		text: "var(--color-accent)",
	},
	upstream: {
		fill: "var(--color-surface-elevated)",
		stroke: "var(--color-border-bright)",
		text: "var(--color-text-bright)",
	},
	agent: {
		fill: "var(--color-info-dim, rgba(96, 165, 250, 0.12))",
		stroke: "var(--color-info)",
		text: "var(--color-info)",
	},
	chain: {
		fill: "var(--color-secondary-dim)",
		stroke: "var(--color-secondary)",
		text: "var(--color-secondary)",
	},
};

export function NetworkStrip() {
	return (
		<section
			aria-labelledby="network-strip-headline"
			className="relative border-y border-border-subtle py-14 sm:py-16 bg-[var(--color-surface)]/30"
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial opacity-25"
			/>

			<div className="container-page">
				<Reveal>
					<SectionHeader
						eyebrow="Network"
						headline={
							<>
								Eight programmable primitives.
								<br />
								<span className="text-text-secondary">One auth. One rate limit. One ledger.</span>
							</>
						}
						subhead="Same OMA auth as the inference endpoint. Token-bucket rate limits, request signing, audit log, circuit-breaker telemetry, deposit feeds, webhooks, MCP, and an agent card — all behind your existing API key."
					/>
				</Reveal>

				<div className="mt-14 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
					<Reveal>
						<figure className="border border-border rounded-[var(--radius-lg)] bg-[var(--color-void)] p-4 sm:p-6 overflow-hidden">
							<svg
								viewBox="0 0 640 320"
								role="img"
								aria-label="OMA network topology. An agent connects to OMA, which routes to Venice, AntSeed, and OpenRouter upstream providers. OMA also connects to Base chain for USDC settlement."
								className="w-full h-auto"
								preserveAspectRatio="xMidYMid meet"
							>
								<defs>
									<marker
										id="ns-arrow"
										viewBox="0 0 10 10"
										refX="9"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path d="M0 0 L10 5 L0 10 z" fill="var(--color-text-tertiary)" />
									</marker>
									<marker
										id="ns-arrow-dashed"
										viewBox="0 0 10 10"
										refX="9"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path d="M0 0 L10 5 L0 10 z" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1" />
									</marker>
									<marker
										id="ns-arrow-accent"
										viewBox="0 0 10 10"
										refX="9"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path d="M0 0 L10 5 L0 10 z" fill="var(--color-accent)" />
									</marker>
									<marker
										id="ns-arrow-secondary"
										viewBox="0 0 10 10"
										refX="9"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path d="M0 0 L10 5 L0 10 z" fill="var(--color-secondary)" />
									</marker>
								</defs>

								{/* Edges */}
								{/* agent -> oma (accent, primary path) */}
								<line
									x1={140}
									y1={120}
									x2={280}
									y2={120}
									stroke="var(--color-accent)"
									strokeWidth="1.5"
									markerEnd="url(#ns-arrow-accent)"
								/>
								<text
									x={210}
									y={112}
									textAnchor="middle"
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-accent)"
								>
									auth + meter
								</text>

								{/* oma -> upstreams */}
								<line x1={360} y1={120} x2={520} y2={60} stroke="var(--color-text-tertiary)" strokeWidth="1" markerEnd="url(#ns-arrow)" />
								<line x1={360} y1={120} x2={520} y2={140} stroke="var(--color-text-tertiary)" strokeWidth="1" markerEnd="url(#ns-arrow)" />
								<line x1={360} y1={120} x2={520} y2={220} stroke="var(--color-text-tertiary)" strokeWidth="1" strokeDasharray="3 3" markerEnd="url(#ns-arrow-dashed)" />

								<text x={440} y={86} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-text-tertiary)">
									route
								</text>
								<text x={440} y={134} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-text-tertiary)">
									failover
								</text>
								<text x={440} y={186} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-text-tertiary)">
									backup
								</text>

								{/* oma -> base (settlement) */}
								<line
									x1={320}
									y1={150}
									x2={320}
									y2={220}
									stroke="var(--color-secondary)"
									strokeWidth="1.5"
									markerEnd="url(#ns-arrow-secondary)"
								/>
								<text
									x={344}
									y={196}
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-secondary)"
								>
									x402 · USDC
								</text>

								{/* Nodes */}
								{NODES.map((n) => {
									const style = NODE_STYLE[n.kind];
									return (
										<g key={n.id}>
											<rect
												x={n.x}
												y={n.y}
												width={80}
												height={36}
												rx={4}
												fill={style.fill}
												stroke={style.stroke}
												strokeWidth={n.kind === "oma" ? 1.5 : 1}
											/>
											<text
												x={n.x + 40}
												y={n.y + 22}
												textAnchor="middle"
												fontSize="10"
												fontFamily="var(--font-mono)"
												fill={style.text}
												letterSpacing="0.04em"
											>
												{n.label}
											</text>
										</g>
									);
								})}

								{/* Animated pulse on agent -> oma line */}
								<circle r="3" fill="var(--color-accent)">
									<animateMotion
										dur="3s"
										repeatCount="indefinite"
										path="M 140 120 L 280 120"
									/>
									<animate
										attributeName="opacity"
										values="0;1;1;0"
										keyTimes="0;0.1;0.9;1"
										dur="3s"
										repeatCount="indefinite"
									/>
								</circle>
							</svg>
							<figcaption className="mt-3 text-[11px] font-mono text-text-muted text-center">
								<span className="text-accent">$</span> live topology · 1 agent · 3 upstreams · 1 chain
							</figcaption>
						</figure>
					</Reveal>

					<Reveal>
						<div className="space-y-4">
							<h3 id="network-strip-headline" className="font-heading text-xl font-semibold text-text-bright">
								Built like telco infrastructure.
							</h3>
							<p className="text-[14px] text-text-secondary leading-relaxed">
								GSMA OpenGateway proved that telcos can expose their network as
								standardized APIs. We took the same idea and applied it to AI
								inference — the gateway is the API surface.
							</p>
							<ul className="space-y-2 list-none p-0">
								{[
									{ label: "Token-bucket rate limit", note: "inspect, not consume" },
									{ label: "Request signing (HMAC)", note: "pin a downstream key" },
									{ label: "Audit log feed", note: "append-only, sha256-chained" },
									{ label: "Circuit-breaker telemetry", note: "live provider health" },
									{ label: "Deposit watcher feed", note: "WS push, <12s latency" },
								].map((item) => (
									<li
										key={item.label}
										className="flex items-start gap-3 text-[13px] text-text-secondary"
									>
										<Network className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" aria-hidden="true" />
										<div className="min-w-0">
											<span className="text-text">{item.label}</span>
											<span className="text-text-tertiary"> · {item.note}</span>
										</div>
									</li>
								))}
							</ul>
							<Link
								href="/network"
								className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
							>
								Browse all 8 primitives
								<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
							</Link>
						</div>
					</Reveal>
				</div>
			</div>
		</section>
	);
}