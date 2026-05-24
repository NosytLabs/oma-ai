export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface ErrorRetryConfig {
  rateLimit: RetryPolicy;
  timeout: RetryPolicy;
  badRequest: RetryPolicy;
  connectionError: RetryPolicy;
  serverError: RetryPolicy;
}

export const DEFAULT_ERROR_RETRY_CONFIG: ErrorRetryConfig = {
  rateLimit: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  timeout: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  badRequest: {
    maxRetries: 1,
    initialDelayMs: 200,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
  },
  connectionError: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  serverError: {
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
  },
};

export type ErrorType =
  | "rate_limit_error"
  | "timeout_error"
  | "bad_request_error"
  | "connection_error"
  | "server_error"
  | "unknown_error";

export function classifyError(status: number, message?: string): ErrorType {
  if (status === 429) return "rate_limit_error";
  if (status === 400) return "bad_request_error";
  if (status >= 500) return "server_error";
  if (status === 408 || message?.includes("timeout")) return "timeout_error";
  if (status === 0 || message?.includes("ECONNREFUSED") || message?.includes("network")) {
    return "connection_error";
  }
  return "unknown_error";
}

export function getRetryPolicy(errorType: ErrorType, config: ErrorRetryConfig = DEFAULT_ERROR_RETRY_CONFIG): RetryPolicy {
  switch (errorType) {
    case "rate_limit_error":
      return config.rateLimit;
    case "timeout_error":
      return config.timeout;
    case "bad_request_error":
      return config.badRequest;
    case "connection_error":
      return config.connectionError;
    case "server_error":
      return config.serverError;
    default:
      return {
        maxRetries: 1,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      };
  }
}

export function calculateBackoffDelay(attempt: number, policy: RetryPolicy): number {
  const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(delay, policy.maxDelayMs);
}

export class RetryableError extends Error {
  public readonly status: number;
  public readonly errorType: ErrorType;
  public readonly isRetryable: boolean;

  constructor(message: string, status: number, errorType: ErrorType) {
    super(message);
    this.name = "RetryableError";
    this.status = status;
    this.errorType = errorType;
    this.isRetryable = errorType !== "bad_request_error";
  }
}

export interface RetryState {
  attempts: number;
  lastAttempt: number;
  nextRetryMs: number;
}

export function createRetryState(): RetryState {
  return {
    attempts: 0,
    lastAttempt: 0,
    nextRetryMs: 0,
  };
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    policy: RetryPolicy;
    errorClassifier?: (error: unknown) => { status: number; message?: string };
    onRetry?: (attempt: number, delay: number, error: unknown) => void;
    signal?: AbortSignal;
  }
): Promise<T> {
  const { policy, errorClassifier, onRetry, signal } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxRetries + 1; attempt++) {
    if (signal?.aborted) {
      throw new Error("Retry operation aborted");
    }

    try {
      return await operation();
    } catch (err) {
      lastError = err;

      const shouldRetry = attempt <= policy.maxRetries;
      
      if (!shouldRetry) {
        break;
      }

      const classifier = errorClassifier ?? ((e: unknown) => {
        const error = e as { status?: number; message?: string };
        return {
          status: error.status ?? 0,
          message: error.message,
        };
      });

      const { status, message } = classifier(err);
      const errorType = classifyError(status, message);
      const errorPolicy = getRetryPolicy(errorType);

      if (!errorPolicy || errorType === "bad_request_error") {
        throw err;
      }

      const delay = calculateBackoffDelay(attempt, errorPolicy);

      if (onRetry) {
        onRetry(attempt, delay, err);
      }

      await sleep(delay, signal);
    }
  }

  throw lastError;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new Error("Sleep aborted"));
    });
  });
}

export const RateLimitErrorRetries = DEFAULT_ERROR_RETRY_CONFIG.rateLimit.maxRetries;
export const TimeoutErrorRetries = DEFAULT_ERROR_RETRY_CONFIG.timeout.maxRetries;
export const BadRequestErrorRetries = DEFAULT_ERROR_RETRY_CONFIG.badRequest.maxRetries;

export const DEFAULT_RETRY_CONFIG = DEFAULT_ERROR_RETRY_CONFIG;