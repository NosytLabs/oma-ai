import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from '@/components/footer'

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
    const githubLink = screen.getByText('GitHub')
    expect(githubLink).toBeInTheDocument()
    expect(githubLink).toHaveAttribute('href', 'https://github.com/oma-ai')
  })

  it('renders infrastructure status', () => {
    render(<Footer />)
    expect(screen.getByText('Built on Base')).toBeInTheDocument()
  })

  it('renders copyright', () => {
    render(<Footer />)
    expect(screen.getByText(/2026 OMA AI/)).toBeInTheDocument()
  })
})