import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  // HomePage is an async server component (it awaits fetchLiveModels()).
  // In jsdom we render it synchronously, but the fetch resolves later; the
  // HomeClient children only paint once the Promise settles. Use findBy /
  // waitFor so we assert against the post-resolve DOM, not the pre-resolve
  // empty Suspense fallback. Without this, vitest reports
  // "A component suspended inside an `act` scope, but the `act` call was
  // not awaited" and every assertion fails on an empty <body>.
  it('renders the hero headline', async () => {
    renderWithQueryClient(<HomePage />)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders the three value props', async () => {
    renderWithQueryClient(<HomePage />)
    await waitFor(() => {
      expect(screen.getAllByText(/one key, every model/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/pay per request/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/anonymous|no KYC|no email/i).length).toBeGreaterThan(0)
    })
  })

  it('renders the how it works steps', async () => {
    renderWithQueryClient(<HomePage />)
    await waitFor(() => {
      expect(screen.getAllByText(/connect wallet/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/add credits/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/start building/i).length).toBeGreaterThan(0)
    })
  })

  it('renders primary CTAs', async () => {
    renderWithQueryClient(<HomePage />)
    const playgroundLinks = await screen.findAllByRole('link', { name: /try the playground/i })
    expect(playgroundLinks.length).toBeGreaterThan(0)
    expect(playgroundLinks[0]).toHaveAttribute('href', '/playground')
  })

  it('renders pricing and models links', async () => {
    renderWithQueryClient(<HomePage />)
    await waitFor(() => {
      const pricingLinks = screen.getAllByRole('link', { name: /see (full )?pricing/i })
      expect(pricingLinks.length).toBeGreaterThan(0)
      expect(pricingLinks[0]).toHaveAttribute('href', '/pricing')

      const modelsLinks = screen.getAllByRole('link', { name: /view models|browse all models/i })
      expect(modelsLinks.length).toBeGreaterThan(0)
      expect(modelsLinks[0]).toHaveAttribute('href', '/models')
    })
  })

  it('renders the pricing tease stats', async () => {
    renderWithQueryClient(<HomePage />)
    await waitFor(() => {
      expect(screen.getAllByText(/pay per request/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/1M tokens/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/from \$0\.06/i).length).toBeGreaterThan(0)
    })
  })

  it('renders the FAQ tease', async () => {
    renderWithQueryClient(<HomePage />)
    await waitFor(() => {
      expect(screen.getAllByText(/do i need an account/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/quick answers/i).length).toBeGreaterThan(0)
    })
  })

  it('renders model cards as clickable links', async () => {
    renderWithQueryClient(<HomePage />)
    const modelLinks = await screen.findAllByRole('link', { name: /details/i })
    expect(modelLinks.length).toBeGreaterThan(0)
    expect(modelLinks[0]).toHaveAttribute('href', '/models')
  })
})

describe('Footer', () => {
  it('renders product links', () => {
    renderWithQueryClient(<Footer />)
    expect(screen.getByText('models')).toBeInTheDocument()
    expect(screen.getByText('pricing')).toBeInTheDocument()
    expect(screen.getByText('docs')).toBeInTheDocument()
    expect(screen.getByText('playground')).toBeInTheDocument()
  })

  it('renders legal links', () => {
    renderWithQueryClient(<Footer />)
    expect(screen.getByText('terms')).toBeInTheDocument()
    expect(screen.getByText('privacy')).toBeInTheDocument()
  })

  it('renders OMA brand', () => {
    renderWithQueryClient(<Footer />)
    expect(screen.getByText('oma')).toBeInTheDocument()
  })

  it('renders GitHub link', () => {
    renderWithQueryClient(<Footer />)
    const githubLink = screen.getByText('github.com/oma-ai')
    expect(githubLink).toBeInTheDocument()
    expect(githubLink).toHaveAttribute('href', 'https://github.com/oma-ai')
  })

  it('renders infrastructure status', () => {
    renderWithQueryClient(<Footer />)
    expect(screen.getByText(/permissionless.*inference/i)).toBeInTheDocument()
  })

  it('renders copyright', () => {
    renderWithQueryClient(<Footer />)
    expect(screen.getByText(/OMA AI/)).toBeInTheDocument()
  })
})
