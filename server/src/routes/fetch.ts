import { Hono } from 'hono';
import { bearerAuth } from '../auth/middleware.js';
import { fetchWebPages } from '../inference/tinyfish-fetch.js';
import { tokenBucket } from '../middleware/rate-limit.js';
import { isWebhookUrlSafe } from '../lib/url-safety.js';
import type { OmaEnv } from '../types.js';

export const fetchRoutes = new Hono<OmaEnv>();

fetchRoutes.use('/v1/fetch/*', bearerAuth);
fetchRoutes.use('/v1/fetch/*', tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));

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
    // H2: use the shared SSRF guard from lib/url-safety.ts so all
    // user-controlled URL entry points share a single, well-tested
    // implementation. The private `isUrlSafe` previously defined here
    // had a less-comprehensive private-IP range table (it missed
    // 0.0.0.0/8, 100.64.0.0/10 CGNAT, 192.0.0.0/24, 198.18.0.0/15
    // benchmarking, 224.0.0.0/4 multicast, and 169.254.0.0/16
    // link-local) which let some SSRF payloads through.
    const safety = await isWebhookUrlSafe(url);
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