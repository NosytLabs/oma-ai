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

