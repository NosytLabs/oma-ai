import { Hono } from 'hono';
import { z } from 'zod';
import { bearerAuth } from '../auth/middleware.js';
import { fetchWebPages } from '../inference/tinyfish-fetch.js';
import { tokenBucket } from '../middleware/rate-limit.js';
import { isWebhookUrlSafe } from '../lib/url-safety.js';
import type { OmaEnv } from '../types.js';

export const fetchRoutes = new Hono<OmaEnv>();

fetchRoutes.use('/v1/fetch/*', bearerAuth);
fetchRoutes.use('/v1/fetch/*', tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));

fetchRoutes.post('/v1/fetch', async (c) => {
  const fetchSchema = z.object({ urls: z.array(z.string().url()).min(1).max(10) });
  const parsed = fetchSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { urls } = parsed.data;

  for (const url of urls) {
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

  const results = await fetchWebPages(urls);

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