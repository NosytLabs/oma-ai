"use client";

import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function PricingError({ error, reset }: ErrorPageProps) {
	return (
		<RouteErrorFallback
			error={error}
			reset={reset}
			title="Pricing Error"
			routeName="pricing"
		/>
	);
}
