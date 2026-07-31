"use client";

import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";

const AdminDashboard = lazy(() =>
	import("./_components/AdminDashboard").then((m) => ({
		default: m.AdminDashboard,
	})),
);

function DashboardSkeleton() {
	return (
		<div className="flex items-center gap-2 text-text-secondary">
			<Loader2 className="h-4 w-4 animate-spin" /> Loading operator dashboard…
		</div>
	);
}

export default function AdminPage() {
	return (
		<ErrorBoundary fallback={null}>
			<Suspense fallback={<DashboardSkeleton />}>
				<AdminDashboard />
			</Suspense>
		</ErrorBoundary>
	);
}
