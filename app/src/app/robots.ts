import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/settings', '/deposit', '/stake', '/api-keys'],
      },
    ],
    sitemap: 'https://oma-ai.com/sitemap.xml',
    host: 'https://oma-ai.com',
  }
}