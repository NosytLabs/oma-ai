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
    expect(screen.getByText('MODELS')).toBeInTheDocument()
  })

  it('renders category filter buttons', () => {
    render(<ModelsPage />)
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /budget/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mid/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /premium/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /frontier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /coding/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reasoning/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /uncensored/i })).toBeInTheDocument()
  })

  it('renders the stats bar showing model count', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      expect(screen.getByText(/models available/i)).toBeInTheDocument()
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
    const budgetButton = screen.getByRole('button', { name: /budget/i })
    fireEvent.click(budgetButton)
    await waitFor(() => {
      const clearFilterButton = screen.getByRole('button', { name: /clear filter/i })
      expect(clearFilterButton).toBeInTheDocument()
    })
  })

  it('search input filters models', async () => {
    render(<ModelsPage />)
    const searchInput = screen.getByPlaceholderText(/search models/i)
    fireEvent.change(searchInput, { target: { value: 'claude' } })
    await waitFor(() => {
      expect(screen.getAllByText(/claude/i).length).toBeGreaterThan(0)
    })
  })

  it('clear filter appears when a filter is active', async () => {
    render(<ModelsPage />)
    const budgetButton = screen.getByRole('button', { name: /budget/i })
    fireEvent.click(budgetButton)
    await waitFor(() => {
      expect(screen.getByText(/clear filter/i)).toBeInTheDocument()
    })
  })

  it('renders provider legend with Venice AI, AntSeed P2P, and Both', async () => {
    render(<ModelsPage />)
    await waitFor(() => {
      expect(screen.getAllByText(/venice ai/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/antseed p2p/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/both/i).length).toBeGreaterThan(0)
    })
  })

  it('models page does not crash on render', () => {
    expect(() => render(<ModelsPage />)).not.toThrow()
  })
})