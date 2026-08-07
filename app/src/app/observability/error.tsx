"use client";

import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

interface ErrorPageProps {
 error: Error & { digest?: string };
 reset: () => void;
}

export default function ObservabilityError({ error, reset }: ErrorPageProps) {
 return (
 <RouteErrorFallback
 error={error}
 reset={reset}
 title="Observability Error"
 routeName="observability"
 />
 );
}
