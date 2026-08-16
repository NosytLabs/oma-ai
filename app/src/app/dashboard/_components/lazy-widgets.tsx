"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

export const LazyExpiringCreditsWarning = dynamic(
	() =>
		import("@/components/dashboard/ExpiringCreditsWarning").then(
			(mod) => mod.ExpiringCreditsWarning,
		),
	{ ssr: false, loading: () => <Skeleton className="h-20 w-full" /> },
);

export const LazyProviderHealthSummary = dynamic(
	() =>
		import("@/components/dashboard/ProviderHealthSummary").then(
			(mod) => mod.ProviderHealthSummary,
		),
	{
		ssr: false,
		loading: () => (
			<div className="flex min-h-[12rem] flex-col rounded-[var(--radius-xl)] border border-border bg-surface/30 p-6">
				<Skeleton className="mb-2 h-4 w-28" />
				<Skeleton className="mb-6 h-3 w-40" />
				<Skeleton className="mb-2 h-4 w-32" />
				<div className="space-y-2 border border-border p-2">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
				</div>
			</div>
		),
	},
);

export const LazyUsageChart = dynamic(
	() =>
		import("@/components/dashboard/UsageChart").then((mod) => mod.UsageChart),
	{
		ssr: false,
		loading: () => (
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div className="rounded-[var(--radius-xl)] border border-border bg-surface/30 p-6">
					<Skeleton className="h-4 w-20 mb-4" />
					<Skeleton className="h-[300px] w-full" />
				</div>
				<div className="rounded-[var(--radius-xl)] border border-border bg-surface/30 p-6">
					<Skeleton className="h-4 w-24 mb-4" />
					<Skeleton className="h-[280px] w-full" />
				</div>
			</div>
		),
	},
);

export const LazyProviderHealthCard = dynamic(
	() =>
		import("@/components/dashboard/ProviderHealthCard").then(
			(mod) => mod.ProviderHealthCard,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

export const LazyApiKeyManager = dynamic(
	() =>
		import("@/components/dashboard/ApiKeyManager").then(
			(mod) => mod.ApiKeyManager,
		),
	{ ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

export const LazyRecentRequestsTable = dynamic(
	() =>
		import("@/components/dashboard/RecentRequestsTable").then(
			(mod) => mod.RecentRequestsTable,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

export const LazyModelUsageTable = dynamic(
	() =>
		import("@/components/dashboard/ModelUsageTable").then(
			(mod) => mod.ModelUsageTable,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

export const LazyProviderBreakdown = dynamic(
	() =>
		import("@/components/dashboard/ProviderBreakdown").then(
			(mod) => mod.ProviderBreakdown,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

export const LazyCreatedKeyModal = dynamic(
	() =>
		import("@/components/dashboard/CreatedKeyModal").then(
			(mod) => mod.CreatedKeyModal,
		),
	{ ssr: false, loading: () => null },
);