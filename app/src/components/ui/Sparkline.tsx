"use client";

import { useId, useMemo } from "react";

interface SparklineProps {
	/** Series of numeric values. Render an empty-state if length < 2. */
	values: number[];
	/** Tailwind height class, e.g. "h-8". */
	heightClass?: string;
	/** Stroke color (CSS color or var). Defaults to accent. */
	stroke?: string;
	/**
	 * "trend" colors the line success/error by direction; "neutral" always
	 * uses the brand accent (for metrics where direction is not good/bad,
	 * e.g. spend).
	 */
	tone?: "trend" | "neutral";
	/** Optional className for the wrapping svg. */
	className?: string;
	/** Show a small dot at the latest value. Default true. */
	showLastDot?: boolean;
	/**
	 * Accessible label. Renders into a <title> inside the SVG so screen
	 * readers announce the trend without seeing the raw numbers.
	 */
	ariaLabel?: string;
}

/**
	* Tiny inline trend chart. No axes, no labels — just the shape. Designed
	* to slot into a card next to a big number and add depth without competing
	* with the AreaChart / BarChart in the charts/ folder.
	*
	* Built on plain SVG (no recharts dep) so it stays a few hundred bytes
	* and renders server-side without `<svg>` hydration mismatches.
	*/
export function Sparkline({
	values,
	heightClass = "h-8",
	stroke = "var(--color-accent)",
	tone = "trend",
	className = "",
	showLastDot = true,
	ariaLabel = "Trend over time",
}: SparklineProps) {
	// useId() must run unconditionally; build the gradient id even if the
	// empty-state early return fires so the IDs stay consistent across renders.
	const instanceId = useId();
	const gradientId = `sparkline-grad-${instanceId}`;

	const { d, area, lastX, lastY, viewBox } = useMemo(() => {
		if (values.length < 2)
			return { d: "", area: "", lastX: 0, lastY: 0, viewBox: "0 0 100 30" };
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		const w = 100;
		const h = 30;
		const stepX = w / (values.length - 1);
		const points = values.map((v, i) => {
			const x = i * stepX;
			const y = h - ((v - min) / range) * h;
			return [x, y] as const;
		});
		const path = points
			.map(
				([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`,
			)
			.join(" ");
		const [lx, ly] = points[points.length - 1];
		const areaPath = `${path} L ${(w).toFixed(2)} ${h} L 0 ${h} Z`;
		return {
			d: path,
			area: areaPath,
			lastX: lx,
			lastY: ly,
			viewBox: `0 0 ${w} ${h}`,
		};
	}, [values]);

	if (values.length < 2) {
		// Render a flat baseline so the card layout doesn't jump when data
		// arrives (avoids the row "popping" in once the first sample lands).
		return (
			<svg
				viewBox="0 0 100 30"
				preserveAspectRatio="none"
				aria-hidden="true"
				className={`${heightClass} w-full ${className}`}
			>
				<line
					x1="0"
					y1="15"
					x2="100"
					y2="15"
					stroke="var(--color-border)"
					strokeWidth="1"
					strokeDasharray="2 3"
				/>
			</svg>
		);
	}

	const isUp = values[values.length - 1] > values[0];
	const isFlat = values[values.length - 1] === values[0];
	const trendStroke =
		tone === "neutral"
			? "var(--color-accent)"
			: isFlat
				? "var(--color-accent)"
				: isUp
					? "var(--color-success)"
					: "var(--color-error)";

	return (
		<svg
			viewBox={viewBox}
			preserveAspectRatio="none"
			role="img"
			aria-label={ariaLabel}
			className={`${heightClass} w-full overflow-visible ${className}`}
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={trendStroke} stopOpacity="0.18" />
					<stop offset="100%" stopColor={trendStroke} stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={area} fill={`url(#${gradientId})`} />
			<path
				d={d}
				fill="none"
				stroke={trendStroke}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{showLastDot && (
				<circle
					cx={lastX}
					cy={lastY}
					r="1.5"
					fill={trendStroke}
					stroke={stroke}
					strokeWidth="0.5"
				/>
			)}
		</svg>
	);
}
