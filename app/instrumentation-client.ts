import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Note: Sentry.init() is handled by sentry.client.config.ts for the client
// and sentry.server.config.ts for the server. Calling it here too causes
// a double-init warning. Only init once per runtime.
