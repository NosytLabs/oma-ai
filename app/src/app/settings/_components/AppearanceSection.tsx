"use client";

import { Check } from "lucide-react";
import { THEME_LIST, type Theme, useTheme } from "@/components/ThemeProvider";

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
			className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 sm:p-6 transition-colors duration-200 ease-out hover:border-[var(--color-accent)]/40"
		>
			<header className="mb-6 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2
						id="settings-appearance-heading"
						className="text-lg font-semibold text-text-bright"
					>
						Appearance
					</h2>
					<p className="mt-1 text-sm text-text-muted">
						Switch the accent color used across the dashboard. The base
						background stays dark for contrast.
					</p>
				</div>
				<div
					aria-hidden="true"
					className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-text-muted"
				>
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
					/>
					{theme}
				</div>
			</header>

			<div
				role="radiogroup"
				aria-label="Accent theme"
				className="grid grid-cols-1 gap-3 sm:grid-cols-2"
			>
				{THEME_LIST.map((t) => {
					const isActive = theme === t.id;
					return (
						<div key={t.id} className="relative">
							{/* biome-ignore lint/a11y/useSemanticElements: custom styled radio */}
							<button
								type="button"
								role="radio"
								aria-checked={isActive}
								onClick={() => setTheme(t.id as Theme)}
								className={`group flex w-full min-w-0 items-center gap-4 rounded-[var(--radius-lg)] border px-4 py-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
									isActive
										? "border-[var(--color-accent)]/50 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] shadow-[0_0_20px_-5px_var(--color-accent-glow)]"
										: "border-[var(--color-border)] bg-[var(--color-surface)]/50 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface)]"
								}`}
							>
								<span
									aria-hidden="true"
									className="h-10 w-10 shrink-0 rounded-full border border-[var(--color-border)] transition-shadow duration-300"
									style={{
										background: `radial-gradient(circle at 40% 35%, ${THEME_SWATCH[t.id as Theme]} 0%, ${THEME_SWATCH[t.id as Theme]}66 45%, transparent 72%)`,
										boxShadow: isActive
											? `0 0 18px ${THEME_SWATCH[t.id as Theme]}55`
											: undefined,
									}}
								/>
								<span className="min-w-0 flex-1">
									<span
										className={`block truncate text-sm font-semibold transition-colors duration-200 ease-out ${isActive ? "text-text-bright" : "text-text-secondary group-hover:text-text-bright"}`}
									>
										{t.name}
									</span>
									<span
										className={`block truncate text-[11px] mt-0.5 transition-colors duration-200 ease-out ${isActive ? "text-text-secondary" : "text-text-muted group-hover:text-text-secondary"}`}
									>
										{t.hint}
									</span>
								</span>
								{isActive ? (
									<Check
										className="h-4 w-4 shrink-0 text-[var(--color-accent)] drop-shadow-[0_0_8px_var(--color-accent)]"
										aria-hidden="true"
									/>
								) : null}
							</button>
						</div>
					);
				})}
			</div>
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
