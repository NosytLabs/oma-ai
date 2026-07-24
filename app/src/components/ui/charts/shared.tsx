/**
 * Shared utilities for the OMA-AI chart components.
 *
 * - **Color tokens**: chart colors are referenced via `var(--color-*)` so
 *   they follow theme changes from `app/src/app/globals.css`. recharts
 *   forwards these strings straight into the rendered SVG and the browser
 *   resolves them at draw time.
 * - **Formatters**: currency, compact number, and adaptive date formatters
 *   used by every chart axis and tooltip.
 * - **Empty/Loading states**: small composable pieces that any chart can
 *   slot in to handle the "no data" and "loading" cases consistently.
 * - **Figure wrapper**: each chart is wrapped in `<figure role="img">` with
 *   a `<figcaption className="sr-only">` description for screen readers.
 */

import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

// ─── Color tokens ────────────────────────────────────────────────────────────
// All chart colors are CSS custom properties from `app/src/app/globals.css`.
// recharts writes these strings into the rendered SVG and the browser
// resolves them at paint time, so theme changes propagate without rebuilds.

export const CHART_COLORS = {
	accent: "var(--color-accent)",
	accentHover: "var(--color-accent-hover)",
	secondary: "var(--color-secondary)",
	tertiary: "var(--color-tertiary)",
	emerald: "var(--color-provider-gonka)",
	blue: "var(--color-tertiary)",
	pink: "#f472b6",
	success: "var(--color-success)",
	error: "var(--color-error)",
	warning: "var(--color-warning)",

	// Provider colors (used by SpendByProvider / ProviderHealth)
	providerVenice: "var(--color-provider-venice)",
	providerGonka: "var(--color-provider-gonka)",

	// Axis / grid neutrals
	axis: "var(--color-text-tertiary)",
	grid: "var(--color-border)",
	border: "var(--color-border)",
} as const;

// Ordered categorical palette. Used for arbitrary data.
export const CHART_PALETTE: readonly string[] = [
	CHART_COLORS.accent,
	CHART_COLORS.secondary,
	CHART_COLORS.tertiary,
	CHART_COLORS.pink,
	CHART_COLORS.emerald,
	CHART_COLORS.blue,
	"var(--color-error)",
	"var(--color-tertiary)",
];

/**
 * Build a stable, unique gradient id for a given chart instance. recharts
 * shares the DOM so two `<linearGradient id="costGradient">` defs on the
 * same page will collide and only the first will be referenced. By suffixing
 * with a per-instance token (often the React `useId()` value) we keep
 * every gradient isolated.
 */
export function makeGradientId(base: string, instanceId?: string): string {
	const suffix = instanceId
		? `-${instanceId}`
		: `-${Math.random().toString(36).slice(2, 8)}`;
	return `${base}${suffix}`;
}

/**
 * Pick a color for a given provider name. Falls back to the accent if the
 * provider is unknown, keeping the legend stable for new providers that
 * haven't been branded yet.
 */
export function providerColor(provider: string): string {
	const p = provider.toLowerCase();
	if (p.includes("venice")) return CHART_COLORS.providerVenice;
	if (p.includes("gonka")) return CHART_COLORS.providerGonka;
	return CHART_COLORS.accent;
}

// ─── Formatters ──────────────────────────────────────────────────────────────
//
// `formatAddress` is consolidated in `src/lib/utils.tsx`.
// Recharts axes / tooltips should import from there so every chart in the app
// produces the same shape. The helpers below stay chart-specific (date, etc.).

// ─── Empty / Loading / Figure ────────────────────────────────────────────────

interface ChartEmptyStateProps {
	title?: string;
	description?: string;
	action?: ReactNode;
	ctaLabel?: string;
	ctaHref?: string;
}

/**
 * Standardized empty state for every chart. Shows an inbox icon, a one-line
 * title, optional description, and an optional CTA (e.g., "make a test
 * request") when the page provides a route.
 */
export function ChartEmptyState({
	title = "No data yet",
	description = "Once you start using the API, your activity will show up here.",
	action,
	ctaLabel,
	ctaHref,
}: ChartEmptyStateProps) {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
			<Inbox className="h-7 w-7 text-text-muted" aria-hidden="true" />
			<p className="font-mono text-xs uppercase tracking-widest text-text-muted">
				{title}
			</p>
			{description && (
				<p className="max-w-[28ch] text-[10px] font-mono leading-relaxed text-text-tertiary">
					{description}
				</p>
			)}
			{action ??
				(ctaLabel && ctaHref ? (
					<a
						href={ctaHref}
						className="mt-2 inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 focus-ring"
					>
						{ctaLabel}
					</a>
				) : null)}
		</div>
	);
}
