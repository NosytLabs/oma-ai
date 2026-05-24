import { Hono } from 'hono';
import dns from 'node:dns/promises';
import { bearerAuth } from '../auth/middleware.js';
import { fetchWebPages } from '../inference/tinyfish-fetch.js';
import { tokenBucket } from '../middleware/rate-limit.js';
import type { OmaEnv } from '../types.js';

export const fetchRoutes = new Hono<OmaEnv>();

fetchRoutes.use('/v1/fetch/*', bearerAuth);
fetchRoutes.use('/v1/fetch/*', tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));

const PRIVATE_IP_RANGES = [
  { cidr: '127.0.0.0/8', test: (ip: string) => ip.startsWith('127.') },
  { cidr: '10.0.0.0/8', test: (ip: string) => ip.startsWith('10.') },
  { cidr: '172.16.0.0/12', test: (ip: string) => {
    const parts = ip.split('.');
    return parts[0] === '172' && Number(parts[1]) >= 16 && Number(parts[1]) <= 31;
  }},
  { cidr: '192.168.0.0/16', test: (ip: string) => ip.startsWith('192.168.') },
  { cidr: '169.254.169.254/32', test: (ip: string) => ip === '169.254.169.254' },
  { cidr: '::1/128', test: (ip: string) => ip === '::1' },
  { cidr: 'fc00::/7', test: (ip: string) => {
    const lower = ip.toLowerCase();
    return lower.startsWith('fc') || lower.startsWith('fd');
  }},
  { cidr: 'fe80::/10', test: (ip: string) => ip.toLowerCase().startsWith('fe80') },
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(range => range.test(ip));
}

async function isUrlSafe(url: string): Promise<{ safe: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Only http(s) URLs are allowed' };
  }

  const hostname = parsed.hostname;

  if (isPrivateIp(hostname)) {
    return { safe: false, reason: 'Hostname resolves to a private/reserved IP' };
  }

  try {
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        return { safe: false, reason: 'Hostname resolves to a private/reserved IP' };
      }
    }
  } catch {
    try {
      const v6Addresses = await dns.resolve6(hostname);
      for (const addr of v6Addresses) {
        if (isPrivateIp(addr)) {
          return { safe: false, reason: 'Hostname resolves to a private/reserved IP' };
        }
      }
    } catch {
      return { safe: false, reason: 'Could not resolve hostname' };
    }
  }

  return { safe: true };
}

fetchRoutes.post('/v1/fetch', async (c) => {
  const body = await c.req.json<{ urls: string[] }>();

  if (!body.urls || !Array.isArray(body.urls)) {
    return c.json({ error: 'urls must be an array' }, 400);
  }

  if (body.urls.length === 0 || body.urls.length > 10) {
    return c.json({ error: 'urls must contain 1-10 items' }, 400);
  }

  for (const url of body.urls) {
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return c.json({ error: 'each url must be a valid http(s) URL' }, 400);
    }
    const safety = await isUrlSafe(url);
    if (!safety.safe) {
      return c.json({ error: safety.reason }, 400);
    }
  }

  const results = await fetchWebPages(body.urls);

  return c.json({ results });
});

fetchRoutes.get('/v1/fetch', (c) => {
  return c.json({
    endpoint: '/v1/fetch',
    method: 'POST',
    description: 'Fetch web pages',
    body: {
      urls: 'string[] (max 10 URLs)',
    },
    pricing: 'Free (no credits deducted)',
  });
});