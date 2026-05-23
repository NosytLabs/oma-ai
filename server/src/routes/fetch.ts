import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { fetchWebPages } from '../inference/tinyfish-fetch.js';
import type { OmaEnv } from '../types.js';

export const fetchRoutes = new Hono<OmaEnv>();

fetchRoutes.use('/v1/fetch/*', bearerAuth({ token: '' }));

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