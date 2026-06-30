export interface RateLimitConfig {
  rpm: number;
  tpm: number;
  overrides?: {
    [apiKeyId: string]: { rpm?: number; tpm?: number };
  };
}

const API_KEY_LIMITS: RateLimitConfig = {
  rpm: 60,
  tpm: 120000,
  overrides: {},
};

export function getApiKeyRateLimits(apiKeyId: string): { rpm: number; tpm: number } {
  const override = API_KEY_LIMITS.overrides?.[apiKeyId];
  if (override) {
    return {
      rpm: override.rpm ?? API_KEY_LIMITS.rpm,
      tpm: override.tpm ?? API_KEY_LIMITS.tpm,
    };
  }
  return {
    rpm: API_KEY_LIMITS.rpm,
    tpm: API_KEY_LIMITS.tpm,
  };
}