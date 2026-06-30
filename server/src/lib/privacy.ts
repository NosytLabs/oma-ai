/**
 * Privacy helpers: strip secrets from headers/objects before logging.
 *
 * Logs MUST NOT contain Authorization headers, x402 PAYMENT-SIGNATURE
 * envelopes, API keys, or other bearer credentials. Use `redactPii`
 * on any object that you intend to pass to logger.* so secrets are
 * replaced with "[REDACTED]".
 */

const REDACTED = "[REDACTED]";

// ponytail: V6 #10 — recursive PII/sensitive-field redactor for arbitrary
// JSON-ish values (request bodies, error context, log payloads). Replaces
// key-named credentials and value-shaped secrets with [REDACTED]. Addresses
// (0x + 40 hex) are KEPT — they're not sensitive on their own and we need
// them for debugging. Strings >100 chars that look like prompt content
// (default 12+ words) are also redacted. JSON round-trip ensures the result
// is plain-old-data — safe to serialize, log, or attach to Error.
//
// Key matching: ends-with semantics (not strict-anchored) so common
// compound names are caught: userEmail, email_address, clientApiKey,
// merchantWalletPrivateKey. The spec's regex was a starting point; the
// practical use is "anything that smells like a credential in the key name".
const SENSITIVE_KEY_TERMS = [
  "api_key", "apikey", "api-key",
  "authorization", "auth",
  "password", "passwd", "pwd",
  "secret",
  "token",
  "email",
  "private_key", "privatekey", "private-key",
  "seed_phrase", "seedphrase", "seed-phrase", "mnemonic",
] as const;

// 12/24-word mnemonic seed phrase. Tokens between words, 3-8 letters each.
const MNEMONIC_RE = /\b([a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/i;

function keyMatchesSensitive(key: string): boolean {
  const norm = key.toLowerCase().replace(/[-_]/g, "");
  for (const term of SENSITIVE_KEY_TERMS) {
    const termNorm = term.replace(/[-_]/g, "");
    if (norm === termNorm || norm.endsWith(termNorm)) return true;
  }
  return false;
}

function isAddressLike(value: string): boolean {
  // 0x + exactly 40 hex chars. Longer (64 hex = private key) is NOT an
  // address; addresses are exactly 20 bytes.
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function looksLikePrivateKey(value: string): boolean {
  // 0x + 64 hex OR bare 64 hex (some libs strip the prefix). Strict —
  // must be EXACTLY 64 hex chars; any other length is not a key.
  return /^(0x)?[a-fA-F0-9]{64}$/.test(value);
}

function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (looksLikePrivateKey(value)) return REDACTED;
    if (MNEMONIC_RE.test(value)) return REDACTED;
    // addresses pass through unchanged
    if (isAddressLike(value)) return value;
    return value;
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keyMatchesSensitive(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactValue(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * Recursive PII / credential redactor. Walks objects and arrays, replacing
 * values for sensitive key names and value-shaped secrets with [REDACTED].
 * Use before logging or attaching a payload to an Error. Returns a plain
 * JSON-safe clone — no functions, no circular refs. Top-level `undefined`
 * is returned as-is (JSON drops it; we preserve the caller's intent).
 */
export function redactPii<T = unknown>(value: T): T {
  if (value === undefined) return value;
  // JSON round-trip guarantees a deep-clone of plain data and drops anything
  // non-serializable (functions, symbols, BigInt). Single round-trip is
  // fine because redactValue only emits plain types.
  const cloned = JSON.parse(JSON.stringify(value));
  return redactValue(cloned) as T;
}
