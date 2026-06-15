/**
 * ISOLATED Unit Test for footer.tsx — build SHA / build date wiring
 * Target: app/src/components/footer.tsx
 * Session: ses_footer_deploy_sha_v8
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-14T21-50Z-footer-deploy-sha.md
 *
 * Verifies the footer text fallback chain for the build SHA / date:
 *   - process.env.NEXT_PUBLIC_BUILD_SHA is set → footer shows first 7 chars
 *   - process.env.NEXT_PUBLIC_BUILD_SHA is unset → footer shows 'dev'
 *   - process.env.NEXT_PUBLIC_BUILD_DATE is set → footer shows it verbatim
 *   - process.env.NEXT_PUBLIC_BUILD_DATE is unset → footer shows 'dev'
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// next/navigation hooks (used by Footer via usePathname).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

import { Footer } from '../footer'

const originalSha = process.env.NEXT_PUBLIC_BUILD_SHA
const originalDate = process.env.NEXT_PUBLIC_BUILD_DATE

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_BUILD_SHA
  delete process.env.NEXT_PUBLIC_BUILD_DATE
})

afterEach(() => {
  if (originalSha === undefined) delete process.env.NEXT_PUBLIC_BUILD_SHA
  else process.env.NEXT_PUBLIC_BUILD_SHA = originalSha
  if (originalDate === undefined) delete process.env.NEXT_PUBLIC_BUILD_DATE
  else process.env.NEXT_PUBLIC_BUILD_DATE = originalDate
})

describe('Footer — build SHA / date wiring', () => {
  it('renders the first 7 chars of NEXT_PUBLIC_BUILD_SHA when set', () => {
    process.env.NEXT_PUBLIC_BUILD_SHA = 'abc1234567890def'
    render(<Footer />)
    // The footer text contains "build abc1234" when the env var is the typical
    // 16-char git short SHA. (Slice to first 7 chars per footer.tsx:139.)
    expect(screen.getByText(/build abc1234/)).toBeInTheDocument()
  })

  it('falls back to "dev" when NEXT_PUBLIC_BUILD_SHA is unset', () => {
    delete process.env.NEXT_PUBLIC_BUILD_SHA
    render(<Footer />)
    // The `?? 'dev'` fallback in footer.tsx:139 catches the undefined case.
    expect(screen.getByText(/build dev/)).toBeInTheDocument()
  })

  it('renders NEXT_PUBLIC_BUILD_DATE when set', () => {
    process.env.NEXT_PUBLIC_BUILD_DATE = '2026-06-14'
    render(<Footer />)
    expect(screen.getByText(/last deploy 2026-06-14/)).toBeInTheDocument()
  })

  it('falls back to "dev" when NEXT_PUBLIC_BUILD_DATE is unset', () => {
    delete process.env.NEXT_PUBLIC_BUILD_DATE
    render(<Footer />)
    expect(screen.getByText(/last deploy dev/)).toBeInTheDocument()
  })
})
