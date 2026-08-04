"use client";

import { useTheme, THEME_LIST, type Theme } from "@/components/ThemeProvider";
import { Check } from "lucide-react";

/**
 * Appearance settings — theme switcher surfaced inside /settings.
 * Mirrors the ThemeToggle chip but laid out as a full settings card
 * with labels, hints, and a live preview swatch.
 */
export function AppearanceSection() {
	const { theme, setTheme, accent } = useTheme();

	return (
		<section
			aria-labelledby="settings-appearance-heading"
			className="rounded-2xl border border-border bg-surface/40 p-4 sm:p-6"
		>
			<header className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2
						id="settings-appearance-heading"
						className="text-lg font-semibold text-text-bright"
					>
						Appearance
					</h2>
					<p className="mt-1 text-sm text-text-secondary">
						Switch the accent color used across the dashboard. The base
						background stays dark for contrast.
					</p>
				</div>
				<div
					aria-hidden="true"
					className="flex items-center gap-2 rounded-full border border-border bg-void px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-text-muted"
				>
					<span
						className="h-2.5 w-2.5 rounded-full"
						style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
					/>
					{theme}
				</div>
			</header>

			<ul
				role="radiogroup"
				aria-label="Accent theme"
				className="grid grid-cols-1 gap-2 sm:grid-cols-2"
			>
				{THEME_LIST.map((t) => {
					const isActive = theme === t.id;
					return (
						<li key={t.id}>
							<button
								type="button"
								role="radio"
								aria-checked={isActive}
								onClick={() => setTheme(t.id as Theme)}
								className={`group flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
									isActive
										? "border-accent/40 bg-accent/10 text-text-bright"
										: "border-border bg-void text-text-secondary hover:border-border/80 hover:text-text"
								}`}
							>
								<span
									aria-hidden="true"
									className="h-9 w-9 shrink-0 rounded-full border border-border"
									style={{
										background: `radial-gradient(circle at 40% 35%, ${THEME_SWATCH[t.id as Theme]} 0%, ${THEME_SWATCH[t.id as Theme]}66 45%, transparent 72%)`,
										boxShadow: isActive
											? `0 0 18px ${THEME_SWATCH[t.id as Theme]}55`
											: undefined,
									}}
								/>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-semibold">
										{t.name}
									</span>
									<span className="block truncate text-[11px] text-text-muted">
										{t.hint}
									</span>
								</span>
								{isActive ? (
									<Check
										className="h-4 w-4 shrink-0 text-accent"
										aria-hidden="true"
									/>
								) : null}
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

const THEME_SWATCH: Record<Theme, string> = {
	emerald: "#46d39a",
	amber: "#f0b429",
	mono: "#e8e8e6",
	synth: "#a78bfa",
};

// Keep swatch gradients as solid hex — CSS vars do not resolve inside
// inline `style` background strings the same way as Tailwind utilities.
