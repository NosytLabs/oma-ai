import { cn } from "@/components/ui/utils";
import type { ReactNode } from "react";

/**
	* SectionHeader — shared headline / subhead block used across sections.
	* Convention: max 1 eyebrow per 3 sections, headline + optional subhead.
	* `align` defaults to left; use "center" for narrow banner sections.
	*
	* Eyebrow variant:
	*  - "caps" (default) → mono uppercase with leading dot, accent color
	*  - "pill" → soft rounded badge (page-kicker) — for sections that want
	*    the looser editorial feel (e.g. docs landing hero).
	*/

export interface SectionHeaderProps {
	eyebrow?: string;
	headline: ReactNode;
	subhead?: ReactNode;
	align?: "left" | "center";
	className?: string;
	headlineClassName?: string;
	eyebrowVariant?: "caps" | "pill";
	/** Optional id on the h2 for aria-labelledby on parent sections. */
	id?: string;
}

export function SectionHeader({
	eyebrow,
	headline,
	subhead,
	align = "left",
	className,
	headlineClassName,
	eyebrowVariant = "caps",
	id,
}: SectionHeaderProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-4",
				align === "center" && "items-center text-center",
				className,
			)}
		>
			{eyebrow && (
				<span
					className={cn(
						eyebrowVariant === "caps" ? "section-eyebrow-caps" : "page-kicker",
					)}
				>
					{eyebrow}
				</span>
			)}
			<h2
				id={id}
				className={cn(
					"section-headline text-text-bright text-balance max-w-3xl",
					headlineClassName,
				)}
			>
				{headline}
			</h2>
			{subhead && (
				<p
					className={cn(
						"text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl",
						align === "center" && "mx-auto",
					)}
				>
					{subhead}
				</p>
			)}
		</div>
	);
}