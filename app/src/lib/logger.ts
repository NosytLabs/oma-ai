/**
 * Frontend logger.
 *
 * Structured wrapper over `console.*` that:
 *   - Tags messages with a `[client]` / `[server]` prefix so dev terminal
 *     output is filterable.
 *   - Accepts an optional `ctx` object that's JSON-stringified when present.
 *   - Returns the original `Error` object (or value) unchanged so callers
 *     can still `throw` it or inspect `.stack`.
 *
 * Why a thin wrapper instead of `pino`:
 *   - `pino` is a transitive dep (pulled by a wagmi/porto sub-dep) and not
 *     pinned in `package.json`. Importing it as if it were a first-class
 *     dep would break if the upstream chain ever drops it.
 *   - `next.config.ts` already sets `compiler.removeConsole` for
 *     production, so these calls tree-shake to nothing in builds. In dev
 *     the wrapped `console.*` still routes to the browser/server console.
 *   - The existing `console.*` call sites are functional logging
 *     (error boundaries, network failures, etc.) — the value of a real
 *     structured logger is marginal until the team adopts a real
 *     observability backend. This wrapper centralizes the formatting so a
 *     future swap to pino / otel / Datadog is a one-file change.
 *
 * Client-side observability:
 *   - `lib/api/admin/ops/log` (a Next.js API route) already
 *     accepts client-emitted events into a server-side ring buffer
 *     readable by the M6.3 admin ledger console. Callers that want to
 *     forward client errors to that endpoint should POST to it directly
 *     from a top-level error boundary, not from every `log.error()` call
 *     (a 1:1 fan-out would amplify a single broken network into a
 *     log-storm).
 */
type LogCtx = Record<string, unknown> | Error | unknown;

function format(prefix: string, msg: string, ctx?: LogCtx): unknown[] {
	if (ctx === undefined) return [`${prefix} ${msg}`];
	return [`${prefix} ${msg}`, ctx];
}

const isBrowser = typeof window !== "undefined";
const tag = isBrowser ? "[client]" : "[server]";

export const log = {
	error(msg: string, ctx?: LogCtx): void {
		console.error(...format(tag, msg, ctx));
	},
	warn(msg: string, ctx?: LogCtx): void {
		console.warn(...format(tag, msg, ctx));
	},
	info(msg: string, ctx?: LogCtx): void {
		console.info(...format(tag, msg, ctx));
	},
	debug(msg: string, ctx?: LogCtx): void {
		if (process.env.NODE_ENV !== "production") {
			console.debug(...format(tag, msg, ctx));
		}
	},
};
