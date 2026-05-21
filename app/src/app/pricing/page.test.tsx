import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PricingPage from './page'

const originalIntersectionObserver = global.IntersectionObserver

const mockIntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

beforeEach(() => {
  global.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  global.IntersectionObserver = originalIntersectionObserver
  vi.restoreAllMocks()
})

describe('PricingPage', () => {
  it('renders the pricing page heading', () => {
    render(<PricingPage />)
    expect(screen.getByText('PRICING')).toBeInTheDocument()
  })

  it('renders payment methods section', () => {
    render(<PricingPage />)
    expect(screen.getByText(/payment methods/i)).toBeInTheDocument()
    expect(screen.getByText(/usdc/i)).toBeInTheDocument()
    expect(screen.getByText(/oma token/i)).toBeInTheDocument()
    expect(screen.getByText(/houdiniswap/i)).toBeInTheDocument()
  })

  it('renders staking discounts section with 4 tiers', async () => {
    render(<PricingPage />)
    await waitFor(() => {
      expect(screen.getByText(/staking discounts/i)).toBeInTheDocument()
      expect(screen.getByText(/bronze/i)).toBeInTheDocument()
      expect(screen.getByText(/silver/i)).toBeInTheDocument()
      expect(screen.getByText(/gold/i)).toBeInTheDocument()
      expect(screen.getByText(/platinum/i)).toBeInTheDocument()
    })
  })

  it('renders staking discount percentages', async () => {
    render(<PricingPage />)
    await waitFor(() => {
      expect(screen.getByText(/-3%/i)).toBeInTheDocument()
      expect(screen.getByText(/-6%/i)).toBeInTheDocument()
      expect(screen.getByText(/-10%/i)).toBeInTheDocument()
      expect(screen.getByText(/-15%/i)).toBeInTheDocument()
    })
  })

  it('renders model pricing table', async () => {
    render(<PricingPage />)
    await waitFor(() => {
      expect(screen.getByText(/input \/ 1m/i)).toBeInTheDocument()
      expect(screen.getByText(/output \/ 1m/i)).toBeInTheDocument()
    })
  })

  it('category filter buttons work', async () => {
    render(<PricingPage />)
    const frontierButton = screen.getByRole('button', { name: /frontier/i })
    fireEvent.click(frontierButton)
    await waitFor(() => {
      const rows = screen.getAllByText(/claude opus/i)
      expect(rows.length).toBeGreaterThan(0)
    })
  })

  it('search input filters table rows', async () => {
    render(<PricingPage />)
    const searchInput = screen.getByPlaceholderText(/search models/i)
    fireEvent.change(searchInput, { target: { value: 'claude' } })
    await waitFor(() => {
      expect(screen.getByText(/claude/i)).toBeInTheDocument()
    })
  })

  it('sort dropdown changes sort order', async () => {
    render(<PricingPage />)
    const sortSelect = screen.getByRole('combobox')
    fireEvent.change(sortSelect, { target: { value: 'name' } })
    await waitFor(() => {
      expect(screen.getByText(/sort: name/i)).toBeInTheDocument()
    })
  })

  it('renders credits and billing disclaimer section', () => {
    render(<PricingPage />)
    expect(screen.getByText(/credits.*billing/i)).toBeInTheDocument()
  })

  it('renders CTA buttons linking to deposit and models', async () => {
    render(<PricingPage />)
    await waitFor(() => {
      const depositLinks = screen.getAllByRole('link', { name: /deposit/i })
      expect(depositLinks.length).toBeGreaterThan(0)
    })
    expect(screen.getByRole('link', { name: /view all models/i })).toHaveAttribute('href', '/models')
  })

  it('pricing page does not crash on render', () => {
    expect(() => render(<PricingPage />)).not.toThrow()
  })
})