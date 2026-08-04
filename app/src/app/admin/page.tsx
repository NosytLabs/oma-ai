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
		<div
			className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-10 text-text-secondary sm:px-6"
			aria-busy="true"
			aria-live="polite"
		>
			<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
			<span>Loading admin panel…</span>
		</div>
	);
}

export default function AdminPage() {
	return (
		<ErrorBoundary
			fallback={
				<div className="mx-auto max-w-xl px-4 py-12 text-center">
					<p className="text-sm text-error">
						Operator dashboard failed to load. Refresh the page.
					</p>
				</div>
			}
		>
			<Suspense fallback={<DashboardSkeleton />}>
				<AdminDashboard />
			</Suspense>
		</ErrorBoundary>
	);
}
