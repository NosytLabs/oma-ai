import pino, { type DestinationStream, type Logger } from 'pino';
import { config } from '../config.js';

// NOTE: this module deliberately reads process.env and NEVER imports
// `config`. config.ts imports logger for its validation messages, so a
// `config` import here forms a circular dependency whose module-init
// access would crash while `config` is still undefined. The lazy
// `readConfig()` helper that bridged this was removed along with its only
// caller (`getLoggerEnv`); nothing here needs resolved config, and
// removing the edge entirely is safer than managing it.
// Resolve initial values from process.env only.
const initialNodeEnv = process.env.NODE_ENV ?? 'production';
const isDevelopment = initialNodeEnv !== 'production' && initialNodeEnv !== 'staging';
const initialLevel = process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info');

// pino-pretty is a worker-thread transport that esbuild (Neon Functions'
// bundler) cannot resolve as a runtime target ("unable to determine transport
// target for pino-pretty" -> function fails to load). It is a dev-only
// convenience for a local console. On Neon Functions (NEON_FUNCTION=1) always
// emit plain JSON logs instead. Neon captures console methods and uses them
// to set severity; Pino's default file-descriptor writes can bypass that hook.
const useJsonOnly = process.env.NEON_FUNCTION === '1';
const usePretty = isDevelopment && !useJsonOnly;

const neonConsoleDestination: DestinationStream = {
		write(line) {
				// Pino has already serialized the record (including Error values).
				// Send the full JSON line so structured diagnostic fields survive.
				const record = JSON.parse(line) as { level?: string };
				const output = line.trimEnd();
				switch (record.level) {
						case 'fatal':
						case 'error':
								console.error(output);
								break;
						case 'warn':
								console.warn(output);
								break;
						case 'trace':
						case 'debug':
								// eslint-disable-next-line no-console -- Neon assigns severity from the console method.
								console.debug(output);
								break;
						default:
								// eslint-disable-next-line no-console -- Neon assigns severity from the console method.
								console.info(output);
				}
		},
};

export const logger: Logger = pino({
		level: initialLevel,
		transport: usePretty
				? {
								target: 'pino-pretty',
								options: {
										colorize: true,
										translateTime: 'SYS:standard',
										ignore: 'pid,hostname',
								},
						}
				: undefined,
		formatters: {
				level: (label: string) => ({ level: label }),
		},
		base: {
				service: 'oma-server',
		},
		mixin() {
				return {
						timestamp: new Date().toISOString(),
				};
		},
}, useJsonOnly ? neonConsoleDestination : undefined);

// Re-export for callers that need to inspect resolved config (e.g., a
// runtime health check). Avoids leaking the lazy proxy.
export function getLoggerEnv(): { isDevelopment: boolean; level: string } {
		return {
				isDevelopment: resolveIsDevelopment(),
				level: resolveLevel(),
		};
}
