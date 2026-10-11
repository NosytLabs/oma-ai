/**
	* Single source of truth for dashboard tab + time-range identifiers.
	*
	* The arrays double as runtime iteration sources (dropdowns) AND as type
	* unions via the derived `TabId` / `TimeRangeId` aliases below. Adding a
	* new tab or range here automatically propagates through both.
	*/
import { Clock, Settings, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const TABS = [
	{ id: "overview", label: "Overview", icon: Zap },
	{ id: "usage", label: "Usage", icon: Clock },
	{ id: "api-keys", label: "API Keys", icon: null },
	{ id: "settings", label: "Settings", icon: Settings },
] as const satisfies ReadonlyArray<{
	id: string;
	label: string;
	icon: LucideIcon | null;
}>;

export type TabId = (typeof TABS)[number]["id"];

export const TIME_RANGES = [
	{ id: "24h", label: "24h" },
	{ id: "7d", label: "7d" },
	{ id: "30d", label: "30d" },
	{ id: "all", label: "All" },
] as const satisfies ReadonlyArray<{ id: string; label: string }>;

export type TimeRangeId = (typeof TIME_RANGES)[number]["id"];
