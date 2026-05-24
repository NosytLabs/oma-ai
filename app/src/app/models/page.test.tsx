import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ModelsPage from './page'

const originalIntersectionObserver = global.IntersectionObserver

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeEach(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  global.IntersectionObserver = originalIntersectionObserver
  vi.restoreAllMocks()
})

describe('ModelsPage', () => {
  it('renders the models page heading', () => {
    render(<ModelsPage />)
    expect(screen.getByText(/Every model\. One API\./i)).toBeInTheDocument()
  })

  it('renders category filter buttons', () => {
    render(<ModelsPage />)
    // Get all buttons and check for expected tier and provider filter buttons
    const buttons = screen.getAllByRole('button')
    const buttonTexts = buttons.map(b => b.textContent)
    // Tier filter buttons: All, Budget, Mid-Range, Premium, Frontier
    expect(buttonTexts.some(t => t === 'All')).toBe(true)
    expect(buttonTexts.some(t => t === 'Budget')).toBe(true)
    expect(buttonTexts.some(t => t === 'Mid-Range')).toBe(true)
    expect(buttonTexts.some(t => t === 'Premium')).toBe(true)
    expect(buttonTexts.some(t => t === 'Frontier')).toBe(true)
    // Provider filter buttons: All, Venice, AntSeed
    expect(buttonTexts.some(t => t === 'Venice')).toBe(true)
    expect(buttonTexts.some(t => t === 'AntSeed')).toBe(true)
  })

  it('renders the stats bar showing model count', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      const spans = screen.getAllByText('32')
      expect(spans.length).toBeGreaterThan(0)
    })
  })

  it('renders model cards when models are present', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      expect(screen.getByText('Claude Opus 4.7')).toBeInTheDocument()
    })
  })

  it('category filter click changes active filter', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      const budgetButton = screen.getByRole('button', { name: /budget/i })
      fireEvent.click(budgetButton)
    })
    await waitFor(() => {
      expect(screen.getByText(/Budget Models/i)).toBeInTheDocument()
    })
  })

  it('search input filters models', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search models/i)
      fireEvent.change(searchInput, { target: { value: 'claude' } })
      expect(screen.getAllByText(/claude/i).length).toBeGreaterThan(0)
    })
  })

  it('search with no results shows reset message', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search models/i)
      fireEvent.change(searchInput, { target: { value: 'xyznonexistent123' } })
    })
    await waitFor(() => {
      expect(screen.getByText(/No models match your criteria/i)).toBeInTheDocument()
    })
  })

  it('renders provider legend with Venice, Together AI, and DeepInfra', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      expect(screen.getAllByText(/Venice/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Together AI/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/DeepInfra/i).length).toBeGreaterThan(0)
    })
  })

  it('models page does not crash on render', () => {
    expect(() => render(<ModelsPage />)).not.toThrow()
  })
})

afterEach(() => {
  global.IntersectionObserver = originalIntersectionObserver
  vi.restoreAllMocks()
})