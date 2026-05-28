import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'
import { Footer } from '@/components/footer'

describe('HomePage', () => {
  it('renders routing cards with clarifying descriptions', () => {
    render(<HomePage />)

    expect(screen.getByText('Chat completions, images, video, embeddings')).toBeInTheDocument()
    expect(screen.getByText('Warm standby, automatic failover')).toBeInTheDocument()
    expect(screen.getByText('Web search for real-time answers')).toBeInTheDocument()
  })

  it('renders primary CTA links', () => {
    render(<HomePage />)

    expect(screen.getByRole('link', { name: 'Read the docs' })).toHaveAttribute('href', '/docs')
    expect(screen.getByRole('link', { name: 'Try the playground' })).toHaveAttribute('href', '/playground')
  })
})

describe('Footer', () => {
  it('renders product links', () => {
    render(<Footer />)
    expect(screen.getByText('Models')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Playground')).toBeInTheDocument()
  })

  it('renders legal links', () => {
    render(<Footer />)
    expect(screen.getByText('Terms')).toBeInTheDocument()
    expect(screen.getByText('Privacy')).toBeInTheDocument()
  })

  it('renders OMA brand', () => {
    render(<Footer />)
    expect(screen.getByText('OMA')).toBeInTheDocument()
  })

  it('renders GitHub link', () => {
    render(<Footer />)
    const githubLink = screen.getByText('GITHUB')
    expect(githubLink).toBeInTheDocument()
    expect(githubLink).toHaveAttribute('href', 'https://github.com/oma-ai')
  })

  it('renders infrastructure status', () => {
    render(<Footer />)
    expect(screen.getByText('BASE_CHAIN // ONE MAN ARMY v1.0.0')).toBeInTheDocument()
  })

  it('renders copyright', () => {
    render(<Footer />)
    expect(screen.getByText(/2026 OMA AI/)).toBeInTheDocument()
  })
})
