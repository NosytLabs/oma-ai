/**
 * ISOLATED Unit Test for app/src/app/page.tsx — LARP cleanup
 * Target: /Users/tyson/Desktop/Code/OMA-AI/app/src/app/page.tsx
 * Session: ses_larp_surgical_v1
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-13T21-35Z-landing-faq-larp-cleanup.md
 *
 * Strategy: static string-grep on the target file. We do NOT import the
 * component (it's a server component, hard to import into a node test,
 * and we only care about textual LARP markers, not runtime behavior).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as path from 'node:path'

const TARGET = join(process.cwd(), 'src/app/page.tsx')
const src = readFileSync(TARGET, 'utf8')

describe('app/src/app/page.tsx — LARP cleanup', () => {
  // ===== REMOVED patterns (must be ABSENT after cleanup) =====

  it('removes Hallmark comment block', () => {
    expect(src).not.toMatch(/^\/\* Hallmark · /m)
  })

  it('removes field-manual masthead strip', () => {
    expect(src).not.toMatch(/field manual/)
  })

  it('removes the ▌ glyph masthead decoration', () => {
    // The masthead ▌ lives in <span aria-hidden="true">▌</span>
    // (also the one before the brand name in many pages, but landing
    //  had an additional one inside the masthead strip)
    // We only require the landing masthead ▌ be gone; terms/privacy
    //  still have their own minimal ▌ (out of scope for this task).
    expect(src).not.toMatch(/▌\s*<\/span>\s*<span>oma<\/span>/)
  })

  it('removes BUILD, ISSUED, DOC_ID constants', () => {
    expect(src).not.toMatch(/^const BUILD = /m)
    expect(src).not.toMatch(/^const ISSUED = /m)
    expect(src).not.toMatch(/^const DOC_ID = /m)
  })

  it('removes § markers in JSX section comments', () => {
    // 6 expected: § 01, § 02, § 03, § 04, § 05, § 06
    const sectionComments = src.match(/\{?\/\* ===== § 0\d [A-Z]+ ===== \*\/\}?/g) ?? []
    expect(sectionComments).toEqual([])
  })

  it('removes the old hero "Inference, / without permission."', () => {
    expect(src).not.toMatch(/without permission\./)
  })

  it('removes the binary-contrast subhead', () => {
    expect(src).not.toMatch(/One key works across every provider we route to\./)
  })

  it('removes the § prefix in the old SectionHeading index label', () => {
    // Old SectionHeading rendered <span>§ {index}</span>. The new
    // SectionHeading has no index prop at all. Combined check:
    expect(src).not.toMatch(/§ \{index\}/)
  })

  it('removes the `~ self-custodial wallet to API` tagline', () => {
    expect(src).not.toMatch(/self-custodial wallet to API/)
  })

  it('removes the › glyph inside the primary button', () => {
    expect(src).not.toMatch(/text-\[var\(--color-text-inverse\)\][\s\S]{0,40}›[\s\S]{0,40}<\/span>/)
  })

  it('removes the oma-btn oma-btn--primary/secondary classes', () => {
    expect(src).not.toMatch(/oma-btn oma-btn--primary/)
    expect(src).not.toMatch(/oma-btn oma-btn--secondary/)
  })

  it('removes "schematic" copy in the System state panel', () => {
    expect(src).not.toMatch(/schematic/)
  })

  it('removes font-mono on the body wrapper div', () => {
    // body wrapper is the outer <div> at the top of HomePage
    expect(src).not.toMatch(/min-h-screen bg-\[var\(--color-void\)\][\s\S]{0,180}font-mono/)
  })

  it('removes tracking-widest on small uppercase labels', () => {
    // We expect zero remaining uses of tracking-widest in this file
    const trackingWidest = src.match(/tracking-widest/g) ?? []
    expect(trackingWidest).toEqual([])
  })

  it('removes the "You are routing" procurement closing', () => {
    expect(src).not.toMatch(/You are routing\./)
  })

  it('removes the Build row from the System state panel', () => {
    // The dl maps over [k, v] pairs including ['Build', BUILD].
    // After cleanup that row is gone.
    expect(src).not.toMatch(/\['Build', BUILD\]/)
  })

  it('removes the x402 five-steps body copy that flags LARP #3', () => {
    // The audit flagged: "Five steps, two actors, one receipt."
    // We replace it. Old text must be gone.
    expect(src).not.toMatch(/Five steps, two actors, one receipt/)
  })

  it('removes StatusDot (decorative use) and renames to LiveIndicator', () => {
    // Component rename: StatusDot → LiveIndicator
    expect(src).not.toMatch(/<StatusDot \/>/)
    expect(src).toMatch(/function LiveIndicator\(/)
  })

  it('renames SectionHeading to SectionHeader (or replaces with inline <h2>)', () => {
    // We replace all 6 calls with inline <h2>, so the SectionHeading
    // component itself should no longer be referenced. Component
    // definition may be removed.
    const sectionHeaderComponent = src.match(/function SectionHeading\(/)
    expect(sectionHeaderComponent).toBeNull()
  })

  // ===== KEPT patterns (must be PRESENT after cleanup) =====

  it('keeps the new hero: "One key. / Every model."', () => {
    expect(src).toMatch(/One key\./)
    expect(src).toMatch(/Every model\./)
  })

  it('keeps the new subhead', () => {
    expect(src).toMatch(/Pay per request in USDC\. Wallet auth, no account\./)
  })

  it('replaces the static x402 SVG with a Lottie animation (loaded via client wrapper)', () => {
    // The page itself no longer imports LottiePlayer directly; it imports
    // the client-side FeaturedX402Lottie wrapper, which in turn does the
    // dynamic load. This keeps lottie-react out of the initial bundle.
    expect(src).toMatch(/FeaturedX402Lottie/)
    const wrapper = readFileSync(
      path.join(process.cwd(), 'src/app/_components/FeaturedX402Lottie.tsx'),
      'utf8',
    )
    expect(wrapper).toMatch(/LottiePlayer/)
    expect(wrapper).toMatch(/lottie-x402-flow\.json/)
  })

  it('keeps the new procurement closing', () => {
    // Text wraps onto two lines in the source — match across the newline
    expect(src).toMatch(/The price list is the same[\s\S]*for everyone\./)
  })

  it('keeps the new x402 body copy', () => {
    expect(src).toMatch(/x402 settles a single request for an agent/)
  })

  it('uses btn-primary / btn-secondary for CTAs (not oma-btn)', () => {
    expect(src).toMatch(/btn-primary/)
    expect(src).toMatch(/btn-secondary/)
  })

  it('does not use font-mono on the body wrapper div', () => {
    // The body wrapper class string is now: min-h-screen ... font-sans ...
    expect(src).toMatch(/min-h-screen bg-\[var\(--color-void\)\][\s\S]{0,180}font-sans/)
  })

  it('keeps the real product data (FEATURED_MODELS, PROVIDERS) and uses the x402 Lottie via the client wrapper', () => {
    // The x402 Lottie is now loaded through a small client wrapper
    // (./_components/FeaturedX402Lottie) so that next/dynamic({ssr:false})
    // can keep lottie-react out of the landing page's initial bundle. The
    // page must still import the wrapper, and the wrapper file must still
    // point at the x402 Lottie JSON.
    expect(src).toMatch(/FEATURED_MODELS/)
    expect(src).toMatch(/PROVIDERS/)
    expect(src).toMatch(/FeaturedX402Lottie/)
    const wrapper = readFileSync(
      path.join(process.cwd(), 'src/app/_components/FeaturedX402Lottie.tsx'),
      'utf8',
    )
    expect(wrapper).toMatch(/lottie-x402-flow\.json/)
  })

  it('keeps FEATURED_MODELS length count in the System state panel', () => {
    expect(src).toMatch(/Models.*FEATURED_MODELS\.length/)
  })

  it('keeps metadata export with clean description', () => {
    expect(src).toMatch(/One key for every model\. Pay per request in USDC/)
  })

  it('retains FEATURED_MODELS for `Models ${...} of 19+ shown`', () => {
    // The Models row should still show count
    expect(src).toMatch(/19\+ shown/)
  })

  it('keeps the curl integration snippet', () => {
    expect(src).toMatch(/INTEGRATION_SNIPPET/)
  })

  it('keeps the `3 / 3 online` status copy (real, not schematic)', () => {
    expect(src).toMatch(/3 \/ 3 online/)
  })
})
