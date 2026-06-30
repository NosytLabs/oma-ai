import type { Provider } from './provider-selector.js';

export type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

export interface ChatMessage {
  role: string;
  content: MessageContent;
}

export interface ModelPricing {
  inputPer1k: number
  outputPer1k: number
  provider: Provider
  markup: number
}

/**
 * Standard shape for inference-layer errors. Provider implementations may
 * decorate Errors with these fields so the router / error mapper can surface
 * the correct HTTP status and machine-readable code to callers.
 */
export interface InferenceError extends Error {
  status: number;
  type: string;
  code?: string;
  retryable?: boolean;
  provider?: string;
}

export function isInferenceError(err: unknown): err is InferenceError {
  return err instanceof Error && typeof (err as InferenceError).status === "number";
}
