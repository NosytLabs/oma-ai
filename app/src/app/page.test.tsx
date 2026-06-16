import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './page'
import { Footer } from '@/components/footer'

// AuthNotice (mounted by HomePage via <Suspense>) calls useRouter and
// useSearchParams. Those hooks throw "invariant expected app router to
// be mounted" when rendered outside a Next.js router context, so the
// test would fail. Mocking the module is the documented escape hatch
// for unit-testing components that read query params in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('HomePage', () => {
  it('renders the hero headline', () => {
    renderWithQueryClient(<HomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders the three value props', () => {
    renderWithQueryClient(<HomePage />)
    expect(screen.getAllByText(/one key, every model/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/pay per request/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/no account needed/i).length).toBeGreaterThan(0)
  })

  it('renders the how it works steps', () => {
    renderWithQueryClient(<HomePage />)
    expect(screen.getAllByText(/connect wallet/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/add credits/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/start building/i).length).toBeGreaterThan(0)
  })

  it('renders primary CTAs', () => {
    renderWithQueryClient(<HomePage />)
    const playgroundLinks = screen.getAllByRole('link', { name: /try the playground/i })
    expect(playgroundLinks.length).toBeGreaterThan(0)
    expect(playgroundLinks[0]).toHaveAttribute('href', '/playground')
  })

  it('renders pricing and models links', () => {
    renderWithQueryClient(<HomePage />)
    const pricingLinks = screen.getAllByRole('link', { name: /see pricing/i })
    expect(pricingLinks.length).toBeGreaterThan(0)
    expect(pricingLinks[0]).toHaveAttribute('href', '/pricing')

    const modelsLinks = screen.getAllByRole('link', { name: /see all models|browse all models/i })
    expect(modelsLinks.length).toBeGreaterThan(0)
    expect(modelsLinks[0]).toHaveAttribute('href', '/models')
  })
})

describe('Footer', () => {
  it('renders product links', () => {
    render(<Footer />)
    expect(screen.getByText('models')).toBeInTheDocument()
    expect(screen.getByText('pricing')).toBeInTheDocument()
    expect(screen.getByText('docs')).toBeInTheDocument()
    expect(screen.getByText('playground')).toBeInTheDocument()
  })

  it('renders legal links', () => {
    render(<Footer />)
    expect(screen.getByText('terms')).toBeInTheDocument()
    expect(screen.getByText('privacy')).toBeInTheDocument()
  })

  it('renders OMA brand', () => {
    render(<Footer />)
    expect(screen.getByText('oma')).toBeInTheDocument()
  })

  it('renders GitHub link', () => {
    render(<Footer />)
    const githubLink = screen.getByText('github.com/oma-ai')
    expect(githubLink).toBeInTheDocument()
    expect(githubLink).toHaveAttribute('href', 'https://github.com/oma-ai')
  })

  it('renders infrastructure status', () => {
    render(<Footer />)
    expect(screen.getByText(/one man army/i)).toBeInTheDocument()
  })

  it('renders copyright', () => {
    render(<Footer />)
    expect(screen.getByText(/OMA AI/)).toBeInTheDocument()
  })
})
