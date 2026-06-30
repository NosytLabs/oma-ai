import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '../loading-spinner'

describe('LoadingSpinner', () => {
  it('renders with default variant and accessible label', () => {
    render(<LoadingSpinner />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('renders page variant with custom label', () => {
    render(<LoadingSpinner variant="page" label="Loading fee configuration" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading fee configuration')).toBeInTheDocument()
  })

  it('renders inline variant', () => {
    render(<LoadingSpinner variant="inline" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
