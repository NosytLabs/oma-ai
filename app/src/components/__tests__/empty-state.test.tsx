/**
 * ISOLATED Unit Test for empty-state.tsx
 * Target: app/src/components/empty-state.tsx
 *
 * Verifies the EmptyState component renders icon, title, description,
 * actions (Link or button), and table variant behavior.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Activity, Users, Key } from 'lucide-react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

import { EmptyState } from '../empty-state'

describe('EmptyState — default variant', () => {
  it('renders icon, title, and description', () => {
    render(
      <EmptyState
        icon={Activity}
        title="No Data Available"
        description="Admin statistics will appear here once there is activity."
      />
    )

    expect(screen.getByRole('heading', { name: 'No Data Available' })).toBeInTheDocument()
    expect(screen.getByText('Admin statistics will appear here once there is activity.')).toBeInTheDocument()
    expect(document.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('renders a Link when action has href', () => {
    render(
      <EmptyState
        icon={Users}
        title="No users found"
        action={{ label: 'Go Home', href: '/' }}
      />
    )

    const link = screen.getByRole('link', { name: 'Go Home' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders a button and calls onClick when action has onClick', () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        icon={Key}
        title="No keys found"
        action={{ label: 'Retry', onClick: handleClick }}
      />
    )

    const button = screen.getByRole('button', { name: 'Retry' })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders multiple actions', () => {
    render(
      <EmptyState
        icon={Activity}
        title="No Data Available"
        actions={[
          { label: 'Retry Fetch', onClick: vi.fn() },
          { label: 'Configure Fees', href: '/admin/fees' },
        ]}
      />
    )

    expect(screen.getByRole('button', { name: 'Retry Fetch' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Configure Fees' })).toBeInTheDocument()
  })

  it('renders both action and actions together', () => {
    render(
      <EmptyState
        icon={Activity}
        title="No Data Available"
        action={{ label: 'Primary', href: '/primary' }}
        actions={[{ label: 'Secondary', href: '/secondary' }]}
      />
    )

    expect(screen.getByRole('link', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Secondary' })).toBeInTheDocument()
  })

  it('wraps content in the card container', () => {
    const { container } = render(
      <EmptyState icon={Activity} title="No Data Available" />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('rounded-xl', 'border', 'border-border', 'bg-surface', 'p-8')
  })
})

describe('EmptyState — table variant', () => {
  it('renders content without the card wrapper', () => {
    const { container } = render(
      <EmptyState
        variant="table"
        icon={Users}
        title="No users found"
        description="Try adjusting your search."
      />
    )

    expect(container.firstChild).not.toHaveClass('rounded-xl')
    expect(screen.getByRole('heading', { name: 'No users found' })).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search.')).toBeInTheDocument()
  })
})
