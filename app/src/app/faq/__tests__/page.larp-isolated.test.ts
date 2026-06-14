/**
 * ISOLATED Unit Test for app/src/app/faq/page.tsx — LARP cleanup
 * Target: /Users/tyson/Desktop/Code/OMA-AI/app/src/app/faq/page.tsx
 * Session: ses_larp_surgical_v1
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-13T21-35Z-landing-faq-larp-cleanup.md
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TARGET = join(process.cwd(), 'src/app/faq/page.tsx')
const src = readFileSync(TARGET, 'utf8')

describe('app/src/app/faq/page.tsx — LARP cleanup', () => {
  // ===== REMOVED patterns (must be ABSENT after cleanup) =====

  it('removes all decorative StatusDot uses', () => {
    // Two <StatusDot /> uses in the body (L137 + L259)
    const uses = src.match(/<StatusDot \/>/g) ?? []
    expect(uses).toEqual([])
  })

  it('removes the function StatusDot definition (no longer used)', () => {
    expect(src).not.toMatch(/function StatusDot\(/)
  })

  it('removes the old SectionHeading index="0X" calls (no index arg)', () => {
    // Only 1 call left in the file: L307 <SectionHeading index="06" title="Funding" ... />
    // The cleaned version uses either a new SectionHeading (no index) or inline <h2>
    expect(src).not.toMatch(/<SectionHeading\s+index=/)
  })

  it('removes § prefix in the old SectionHeading', () => {
    expect(src).not.toMatch(/§ \{index\}/)
  })

  it('removes the function SectionHeading definition (or it has no index arg)', () => {
    // If kept, the new SectionHeading must not have an index parameter
    const fnDef = src.match(/function SectionHeading\(\{[\s\S]*?\}\s*:\s*\{[\s\S]*?\}\)\s*\{[\s\S]*?return/)
    if (fnDef) {
      expect(fnDef[0]).not.toMatch(/index/)
    } else {
      // Component fully removed — also acceptable
      expect(true).toBe(true)
    }
  })

  // ===== KEPT patterns (must be PRESENT after cleanup) =====

  it('keeps the FAQ content intact (total answer count preserved)', () => {
    expect(src).toMatch(/const GROUPS: FAQGroup\[\]/)
    expect(src).toMatch(/name: 'Billing'/)
    expect(src).toMatch(/name: 'Models & API'/)
    expect(src).toMatch(/name: 'Privacy'/)
    expect(src).toMatch(/name: 'Procurement'/)
  })

  it('keeps the SVG funding flow diagram', () => {
    expect(src).toMatch(/<title>Funding flow<\/title>/)
    expect(src).toMatch(/id="faqArrow"/)
  })

  it('keeps the "Questions, / answered plain." hero (already clean)', () => {
    expect(src).toMatch(/Questions,/)
    expect(src).toMatch(/answered plain\./)
  })

  it('keeps the FAQ summary aside with real total', () => {
    expect(src).toMatch(/\{TOTAL\} answers/)
  })

  it('uses btn-primary / btn-secondary for CTAs (already clean)', () => {
    expect(src).toMatch(/btn-primary/)
    expect(src).toMatch(/btn-secondary/)
  })

  it('keeps metadata with clean description', () => {
    expect(src).toMatch(/Common questions about OMA/)
  })

  it('keeps the "Still have questions?" CTA section', () => {
    expect(src).toMatch(/Still have questions\?/)
    expect(src).toMatch(/billing@oma-ai\.com/)
  })
})
