/** Frontend logging with an environment prefix and optional error context. */
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
