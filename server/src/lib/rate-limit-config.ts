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

export function setApiKeyRateLimitOverride(
  apiKeyId: string,
  limits: { rpm?: number; tpm?: number }
): void {
  if (!API_KEY_LIMITS.overrides) {
    API_KEY_LIMITS.overrides = {};
  }
  API_KEY_LIMITS.overrides[apiKeyId] = {
    ...(API_KEY_LIMITS.overrides[apiKeyId] ?? {}),
    ...limits,
  };
}

export function clearApiKeyRateLimitOverride(apiKeyId: string): void {
  if (API_KEY_LIMITS.overrides) {
    delete API_KEY_LIMITS.overrides[apiKeyId];
  }
}

export function getDefaultRateLimits(): RateLimitConfig {
  return { ...API_KEY_LIMITS };
}

export function setDefaultRateLimits(config: RateLimitConfig): void {
  API_KEY_LIMITS.rpm = config.rpm;
  API_KEY_LIMITS.tpm = config.tpm;
  API_KEY_LIMITS.overrides = config.overrides ?? {};
}