import pino from 'pino';
import { config } from '../config.js';

const isDevelopment = config.NODE_ENV !== 'production' && config.NODE_ENV !== 'staging';

export const logger = pino({
  level: config.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
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

