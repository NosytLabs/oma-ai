/**
 * Inference namespace: chat completions.
 * x402 namespace: payment protocol verify/settle.
 * Health namespace: server health probe.
 */
import type {
  ChatCompletionsResponse,
  HealthResponse,
  X402SettleResponse,
  X402VerifyResponse,
} from './types.js';
import { request } from './client.js';

export const inference = {
  chatCompletions(body: unknown) {
    return request<ChatCompletionsResponse>('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const x402 = {
  verify() {
    return request<X402VerifyResponse>('/x402/verify', { method: 'POST' });
  },

  settle() {
    return request<X402SettleResponse>('/x402/settle', { method: 'POST' });
  },
};

export const health = {
  get() {
    return request<HealthResponse>('/health');
  },
};
