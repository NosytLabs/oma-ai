import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
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
});

export const logRequest = (correlationId: string, method: string, path: string) => {
  logger.info({ correlationId, method, path, type: 'request' });
};

export const logResponse = (
  correlationId: string,
  method: string,
  path: string,
  status: number,
  durationMs: number,
) => {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  logger[level]({ correlationId, method, path, status, durationMs, type: 'response' });
};

export const logError = (
  correlationId: string,
  error: Error,
  context?: Record<string, unknown>,
) => {
  logger.error({
    correlationId,
    error: { message: error.message, stack: error.stack, name: error.name },
    ...context,
    type: 'error',
  });
};

export const logProviderCall = (
  provider: string,
  model: string,
  durationMs: number,
  success: boolean,
  error?: string,
) => {
  const level = success ? 'info' : 'warn';
  logger[level]({
    provider,
    model,
    durationMs,
    success,
    error,
    type: 'provider_call',
  });
};

export default logger;