/**
 * Health namespace: server health probe.
 */
import type { HealthResponse } from './types.js';
import { request } from './client.js';

export const health = {
  get() {
    return request<HealthResponse>('/health');
  },
};
