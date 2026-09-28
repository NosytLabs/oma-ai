import pino, { type DestinationStream, type Logger } from 'pino';
import { config } from '../config.js';

// IMPORTANT: logger.ts and config.ts have a circular dependency (config
// imports logger for its validation messages). To avoid a circular-import
// trap, do NOT access `config` at module top level — config may still be
// `undefined` while loading. Read from process.env first; only consult
// `config` lazily through a getter that fires after the import cycle
// completes (i.e. on first use, never at module-init time).

type LoggerConfig = {
		nodeEnv: string;
		logLevel: string | undefined;
};

let cachedConfig: LoggerConfig | undefined;
function readConfig(): LoggerConfig {
		if (cachedConfig) return cachedConfig;
		const cfg = config as { NODE_ENV?: string; LOG_LEVEL?: string };
		cachedConfig = {
				nodeEnv: cfg.NODE_ENV ?? process.env.NODE_ENV ?? 'production',
				logLevel: cfg.LOG_LEVEL ?? process.env.LOG_LEVEL,
		};
		return cachedConfig;
}

function resolveIsDevelopment(): boolean {
		return readConfig().nodeEnv !== 'production' && readConfig().nodeEnv !== 'staging';
}

function resolveLevel(): string {
		const c = readConfig();
		return c.logLevel || (resolveIsDevelopment() ? 'debug' : 'info');
}

// Resolve initial values from process.env only. Reading `config` at
// module-init time would crash on circular import — defer to first call.
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
