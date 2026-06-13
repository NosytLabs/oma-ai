import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('HomePage', () => {
  it('renders routing cards with clarifying descriptions', () => {
    render(<HomePage />)

    expect(screen.getByText('Chat, images, video, embeddings')).toBeInTheDocument()
    expect(screen.getByText('Warm standby, automatic handoff')).toBeInTheDocument()
    expect(screen.getByText('Web search for real-time answers')).toBeInTheDocument()
  })

  it('renders primary CTA links', () => {
    render(<HomePage />)

    const docsLinks = screen.getAllByRole('link', { name: /open the docs/i })
    const playgroundLinks = screen.getAllByRole('link', { name: /try the playground/i })
    expect(docsLinks.length).toBeGreaterThan(0)
    expect(playgroundLinks.length).toBeGreaterThan(0)
    expect(docsLinks[0]).toHaveAttribute('href', '/docs')
    expect(playgroundLinks[0]).toHaveAttribute('href', '/playground')
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
