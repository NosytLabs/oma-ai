import * as Sentry from "@sentry/nextjs";

// Client Sentry init lives here (Next.js + Sentry recommend instrumentation-client.ts
// over the legacy sentry.client.config.ts convention, especially with Turbopack).
Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	// Capture 10% of transactions for performance monitoring.
	tracesSampleRate: 0.1,

	// Session Replay — disabled by default to avoid bundle bloat.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,

	debug: process.env.NODE_ENV === "development",

	// Disable Sentry when DSN is not configured
	enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
