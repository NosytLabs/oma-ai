'use client'

import { Loader2 } from 'lucide-react'

export type LoadingSpinnerVariant = 'default' | 'page' | 'inline'

export type LoadingSpinnerProps = {
  variant?: LoadingSpinnerVariant
  label?: string
  className?: string
}

const variantClasses: Record<LoadingSpinnerVariant, string> = {
  default: 'w-5 h-5',
  page: 'w-8 h-8',
  inline: 'w-4 h-4',
}

export function LoadingSpinner({
  variant = 'default',
  label = 'Loading',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} role="status" aria-live="polite">
      <Loader2 className={`${variantClasses[variant]} animate-spin text-accent`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
