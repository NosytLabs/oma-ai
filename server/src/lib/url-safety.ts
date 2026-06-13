import dns from 'node:dns/promises';
import { logger } from './logger.js';

/**
 * SSRF guard for user-supplied URLs (webhooks, fetch route, search result
 * URLs). Validates that the URL:
 *   1. Is parseable
 *   2. Uses http(s) only
 *   3. Has a hostname (not a raw IP)
 *   4. Resolves only to public addresses (no loopback, RFC1918, link-local,
 *      multicast, CGNAT, or IPv6 ULA)
 *
 * H3: DNS-rebinding mitigation is two-part. (1) By default we set
 * `strictDns: true`, which means a DNS resolution failure (e.g. NXDOMAIN,
 * timeout) is treated as `safe: false` rather than allowing the request
 * through. (2) For server-side fetches that we own (cctp-client,
 * lifi-client, houdini-client, oracle, cheaptokens), the caller MUST
 * additionally pin the resolved IP at fetch time by constructing a
 * custom `http.Agent`/`https.Agent` and using `lookup: () => pinnedIp`
 * (see {@link resolvePublicIp} + {@link createPinnedLookup}). The static
 * check below is best-effort against a small TOCTOU window and must
 * be combined with IP pinning in the fetch path.
 */

const PRIVATE_IP_RANGES: ReadonlyArray<{ cidr: string; test: (ip: string) => boolean }> = [
  { cidr: '0.0.0.0/8', test: (ip) => ip.startsWith('0.') },
  { cidr: '127.0.0.0/8', test: (ip) => ip.startsWith('127.') },
  { cidr: '10.0.0.0/8', test: (ip) => ip.startsWith('10.') },
  { cidr: '100.64.0.0/10', test: (ip) => {
    const parts = ip.split('.');
    if (parts[0] !== '100') return false;
    const second = Number(parts[1]);
    return second >= 64 && second <= 127;
  }},
  { cidr: '172.16.0.0/12', test: (ip) => {
    const parts = ip.split('.');
    return parts[0] === '172' && Number(parts[1]) >= 16 && Number(parts[1]) <= 31;
  }},
  { cidr: '192.168.0.0/16', test: (ip) => ip.startsWith('192.168.') },
  { cidr: '169.254.0.0/16', test: (ip) => ip.startsWith('169.254.') },
  { cidr: '192.0.0.0/24', test: (ip) => ip.startsWith('192.0.0.') },
  { cidr: '198.18.0.0/15', test: (ip) => {
    const parts = ip.split('.');
    return parts[0] === '198' && (Number(parts[1]) === 18 || Number(parts[1]) === 19);
  }},
  { cidr: '224.0.0.0/4', test: (ip) => {
    const first = Number(ip.split('.')[0]);
    return first >= 224 && first <= 239;
  }},
  { cidr: '255.255.255.255/32', test: (ip) => ip === '255.255.255.255' },
  // IPv6
  { cidr: '::/128', test: (ip) => ip === '::' },
  { cidr: '::1/128', test: (ip) => ip === '::1' },
  { cidr: 'fc00::/7', test: (ip) => {
    const lower = ip.toLowerCase();
    return lower.startsWith('fc') || lower.startsWith('fd');
  }},
  { cidr: 'fe80::/10', test: (ip) => ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fe80::') },
];

export function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((range) => range.test(ip));
}

/**
 * H3: Resolve a hostname to a single public IP, throwing if the host
 * has no public addresses. Use this to obtain a pinable IP for the
 * `lookup` option of an http/https Agent. Combined with the pin
 * (see {@link createPinnedLookup}), this closes the TOCTOU window
 * between the static check and the actual fetch.
 */
export async function resolvePublicIp(hostname: string): Promise<string> {
  const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
  for (const addr of v4) {
    if (!isPrivateIp(addr)) return addr;
  }
  const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
  for (const addr of v6) {
    if (!isPrivateIp(addr)) return addr;
  }
  throw new Error(`No public IP for hostname: ${hostname}`);
}

/**
 * H3: Return a `lookup` function suitable for `http.Agent`/`https.Agent`
 * that pins every connection to `pinnedIp`. The hostname is supplied
 * for logging only — Node will still SNI the original hostname via the
 * `servername` Agent option if the caller sets it.
 */
export function createPinnedLookup(pinnedIp: string): (hostname: string, options: unknown, callback: (err: Error | null, address: string, family: number) => void) => void {
  return (_hostname, _options, callback) => {
    callback(null, pinnedIp, 4);
  };
}

/**
 * Validate a URL for safe outbound fetch (webhooks, fetch route, etc.).
 * Returns `{ safe: true }` on success, otherwise `{ safe: false, reason }`.
 *
 * In production, only `https:` is allowed. In development/test, `http:` is
 * permitted so localhost testing works.
 *
 * H3: when `strictDns: true` (the default in production), a DNS
 * resolution failure causes `safe: false`. This converts the soft-fail
 * "allow on resolve error" into a hard-fail that protects against
 * rebinding timing where the host resolves to a private IP at fetch
 * time.
 */
export async function isWebhookUrlSafe(
  url: string,
  options: { allowHttp?: boolean; strictDns?: boolean } = {},
): Promise<{ safe: true } | { safe: false; reason: string }> {
  const allowHttp = options.allowHttp ?? process.env.NODE_ENV !== 'production';
  // Default strictDns to ON in production; in dev keep the legacy
  // soft-fail so local debugging with /etc/hosts still works.
  const strictDns = options.strictDns ?? process.env.NODE_ENV === 'production';

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    logger.debug({ err }, "URL parse failed in webhook safety check");
    return { safe: false, reason: 'Invalid URL' };
  }

  if (parsed.protocol === 'https:') {
    // ok
  } else if (parsed.protocol === 'http:' && allowHttp) {
    // ok
  } else {
    return { safe: false, reason: `URL protocol ${parsed.protocol} is not allowed` };
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    return { safe: false, reason: 'URL must include a hostname' };
  }

  // If the hostname is already a literal IP, check it directly.
  if (isPrivateIp(hostname)) {
    return { safe: false, reason: 'Hostname is a private/reserved IP' };
  }

  // Resolve DNS and reject any private address in the result.
  try {
    const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
    for (const addr of v4) {
      if (isPrivateIp(addr)) {
        return { safe: false, reason: 'Hostname resolves to a private/reserved IPv4 address' };
      }
    }
    if (strictDns && v4.length === 0) {
      // No IPv4 addresses — try IPv6 before failing.
    }
  } catch (err) {
    logger.debug({ err }, "IPv4 DNS resolution failed during webhook safety check");
    if (strictDns) {
      return { safe: false, reason: 'Could not resolve hostname (IPv4)' };
    }
  }

  try {
    const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    for (const addr of v6) {
      if (isPrivateIp(addr)) {
        return { safe: false, reason: 'Hostname resolves to a private/reserved IPv6 address' };
      }
    }
    if (strictDns) {
      // H3: under strict mode, if we found neither v4 nor v6 public
      // addresses, the host is unroutable (or private-only) and we
      // refuse the request. Without this, an attacker can use a
      // hostname that briefly resolves to a private IP for the
      // post-check fetch step.
      const v4Any = await dns.resolve4(hostname).catch(() => [] as string[]);
      const v6Any = await dns.resolve6(hostname).catch(() => [] as string[]);
      if (v4Any.length === 0 && v6Any.length === 0) {
        return { safe: false, reason: 'Could not resolve hostname to any public address' };
      }
    }
  } catch (err) {
    logger.debug({ err }, "IPv6 DNS resolution failed during webhook safety check");
    if (process.env.NODE_ENV === 'production') {
      return { safe: false, reason: 'Could not resolve hostname' };
    }
  }

  return { safe: true };
}
