/**
 * Privacy helpers: strip secrets from headers/objects before logging.
 *
 * Logs MUST NOT contain Authorization headers, x402 PAYMENT-SIGNATURE
 * envelopes, API keys, or other bearer credentials. Use `redactHeaders`
 * on any object that you intend to pass to logger.* so secrets are
 * replaced with "[REDACTED]".
 */

const SENSITIVE_HEADER_NAMES = new Set<string>([
  "authorization",
  "payment-signature",
  "x-payment-signature",
  "x-api-key",
  "api-key",
  "x-auth",
  "proxy-authorization",
  "cookie",
  "set-cookie",
]);

const REDACTED = "[REDACTED]";

/**
 * Return a shallow-copied headers record with all sensitive values
 * replaced by "[REDACTED]". Matching is case-insensitive on the key
 * name. Unknown headers pass through unchanged.
 *
 * Accepts Headers, Record<string, string>, or undefined.
 */
export function redactHeaders(
  input: Headers | Record<string, string> | undefined | null,
): Record<string, string> {
  if (!input) return {};
  const out: Record<string, string> = {};
  // Headers has a `get` method and a `forEach` method that takes
  // (value, key). Plain record literals do not have `get`.
  const maybe = input as { get?: unknown; forEach?: unknown };
  if (typeof maybe.get === "function" && typeof maybe.forEach === "function") {
    (input as Headers).forEach((value, key) => {
      out[key] = isSensitiveKey(key) ? REDACTED : value;
    });
    return out;
  }
  for (const [key, value] of Object.entries(input as Record<string, string>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : String(value);
  }
  return out;
}

/**
 * Redact any string-typed value that looks like a bearer/secret token
 * (e.g. "sk-...", "Bearer eyJ..."). Use for ad-hoc log payloads that
 * might contain inline credentials.
 */
export function redactString(value: string | undefined | null): string {
  if (!value) return "";
  if (value.length > 8 && /^[A-Za-z0-9_-]{20,}$/.test(value)) return REDACTED;
  if (/^Bearer\s+[A-Za-z0-9._-]+$/i.test(value)) return `Bearer ${REDACTED}`;
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) return REDACTED;
  return value;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(key.toLowerCase());
}

export { REDACTED as REDACTED_VALUE };
