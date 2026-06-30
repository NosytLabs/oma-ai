"use client";

import { m } from "framer-motion";
import { Box, Globe, Plug, Zap } from "lucide-react";
import { FadeIn, StaggerReveal, scaleInSafe } from "@/lib/motion";

export function FeatureGrid() {
	const features = [
		{
			icon: Plug,
			title: "OpenAI-compatible",
			body: "Swap the base URL. Keep your existing code. The OpenAI SDK works out of the box.",
		},
		{
			icon: Globe,
			title: "Privacy-first",
			body: "Every request routes through Venice AI with zero-log, uncensored inference. No data retention, no vendor lock-in.",
		},
		{
			icon: Zap,
			title: "Streaming & tools",
			body: "Server-sent events, function calling, vision inputs, and JSON mode on every model.",
		},
		{
			icon: Box,
			title: "Image, video, search",
			body: "Generate images, render video, and query the web through the same key.",
		},
	] as const;
	return (
		<section className="border-b border-border">
			<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
				<FadeIn className="text-center mb-10 max-w-2xl mx-auto">
					<h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
						One API. <span className="text-accent">Every capability.</span>
					</h2>
				</FadeIn>

				<StaggerReveal
					stagger={0.08}
					className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
				>
					{features.map((f) => (
						<m.div
							key={f.title}
							variants={scaleInSafe}
							className="rounded-xl border border-border bg-panel/40 p-5 hover:border-accent/40 transition-colors"
						>
							<f.icon className="h-5 w-5 text-accent mb-3" aria-hidden="true" />
							<h3 className="text-sm font-semibold text-text-bright mb-1.5">
								{f.title}
							</h3>
							<p className="text-xs text-text-secondary leading-relaxed">
								{f.body}
							</p>
						</m.div>
					))}
				</StaggerReveal>
			</div>
		</section>
	);
}
