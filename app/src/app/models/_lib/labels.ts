// Labels shared by the /models listing and /models/[slug] detail pages.
// Kept in a client-importable module so both server and client components can use it.

export const TIER_LABELS = {
	budget: "Budget",
	mid: "Mid-Range",
	premium: "Premium",
	frontier: "Frontier",
} as const;

export type TierLabel = keyof typeof TIER_LABELS;
