import { describe, it, expect } from 'vitest'
import sitemap from '../sitemap'
import robots from '../robots'

describe('sitemap.ts - Next.js MetadataRoute.Sitemap', () => {
  it('returns a non-empty array', () => {
    const result = sitemap()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(20)
  })

  it('every entry has a valid https url under oma-ai.com', () => {
    const result = sitemap()
    for (const entry of result) {
      expect(entry.url).toMatch(/^https:\/\/oma-ai\.com(\/.*)?$/)
    }
  })

  it('every entry has lastModified, changeFrequency, priority', () => {
    const result = sitemap()
    for (const entry of result) {
      expect(entry.lastModified).toBeInstanceOf(Date)
      expect(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']).toContain(entry.changeFrequency)
      expect(typeof entry.priority).toBe('number')
      expect(entry.priority).toBeGreaterThanOrEqual(0)
      expect(entry.priority).toBeLessThanOrEqual(1)
    }
  })

  it('includes /about, /faq, /pricing, /docs, /models (critical marketing pages)', () => {
    const result = sitemap()
    const urls = result.map((e) => e.url.replace('https://oma-ai.com', ''))
    for (const required of ['/about', '/faq', '/pricing', '/docs', '/models']) {
      expect(urls).toContain(required)
    }
  })

  it('root entry (/) has priority 1', () => {
    const result = sitemap()
    const root = result.find((e) => e.url === 'https://oma-ai.com')
    expect(root).toBeDefined()
    expect(root?.priority).toBe(1)
  })
})

const rulesArray = (r: ReturnType<typeof robots>) => {
  const rules = r.rules
  return Array.isArray(rules) ? rules : rules ? [rules] : []
}

describe('robots.ts - Next.js MetadataRoute.Robots', () => {
  it('has rules defined', () => {
    const result = robots()
    expect(result).toBeDefined()
    expect(result.rules).toBeDefined()
  })

  it('allows / and disallows private paths for *', () => {
    const result = robots()
    for (const rule of rulesArray(result)) {
      if (rule.userAgent === '*') {
        expect(rule.allow).toBe('/')
        expect(Array.isArray(rule.disallow)).toBe(true)
      }
    }
  })

  it('disallows /api/, /admin, /dashboard, /settings, /login, /api-keys', () => {
    const result = robots()
    for (const rule of rulesArray(result)) {
      if (rule.userAgent === '*') {
        for (const path of ['/api/', '/admin', '/dashboard', '/settings', '/login', '/api-keys']) {
          expect(rule.disallow).toContain(path)
        }
      }
    }
  })

  it('declares sitemap and host', () => {
    const result = robots()
    expect(result.sitemap).toBe('https://oma-ai.com/sitemap.xml')
    expect(result.host).toBe('https://oma-ai.com')
  })
})
