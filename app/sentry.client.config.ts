import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	// Capture 10% of transactions for performance monitoring.
	// Increase if you need more granular traces; decrease to save quota.
	tracesSampleRate: 0.1,

	// Session Replay — disabled by default to avoid bundle bloat.
	// Enable by setting replaysSessionSampleRate > 0 after verifying bundle
	// budget. replaysOnErrorSampleRate captures replays for error sessions.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,

	// Setting this option to true will print useful information to the console
	// while you're setting up Sentry.
	debug: process.env.NODE_ENV === "development",

	// Disable Sentry when DSN is not configured
	enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
