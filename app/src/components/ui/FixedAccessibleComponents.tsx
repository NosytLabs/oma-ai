'use client'

import { forwardRef } from 'react'

/**
 * ================================================
 * ACCESSIBLE BUTTON COMPONENT
 * ================================================
 * Features:
 * - Minimum 44x44px touch target (WCAG 2.5.5)
 * - Visible focus indicators (WCAG 2.4.7)
 * - ARIA support for loading states
 * - Keyboard navigation support
 */

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  function AccessibleButton(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) {
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium transition-all duration-200
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `

    const sizeStyles = {
      sm: 'min-h-[36px] min-w-[36px] px-3 py-1.5 text-xs',
      md: 'min-h-[44px] min-w-[44px] px-4 py-2 text-sm',
      lg: 'min-h-[48px] min-w-[48px] px-6 py-3 text-base',
    }

    const variantStyles = {
      primary: `
        bg-[var(--color-accent)] text-[var(--color-text-inverse)]
        hover:bg-[var(--color-accent-hover)] hover:brightness-110
        focus-visible:ring-[var(--color-accent)]
      `,
      secondary: `
        bg-transparent text-[var(--color-text)] border border-[var(--color-border-bright)]
        hover:bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
        focus-visible:ring-[var(--color-accent)]
      `,
      ghost: `
        bg-transparent text-[var(--color-text-muted)]
        hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]
        focus-visible:ring-[var(--color-accent)]
      `,
      danger: `
        bg-[var(--color-error)] text-white
        hover:brightness-110
        focus-visible:ring-[var(--color-error)]
      `,
    }

    return (
      <button
        ref={ref}
        {...props}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        className={`
          ${baseStyles}
          ${sizeStyles[size]}
          ${variantStyles[variant]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
      >
        {loading && (
          <span className="animate-spin" aria-hidden="true">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        )}
        {!loading && leftIcon && <span aria-hidden="true">{leftIcon}</span>}
        <span>{children}</span>
        {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    )
  }
)

/**
 * ================================================
 * ACCESSIBLE INPUT COMPONENT
 * ================================================
 * Features:
 * - Clear focus states (WCAG 2.4.7)
 * - Proper label associations (WCAG 1.3.1)
 * - Error state styling (WCAG 3.3.1)
 * - Helper text support
 */

interface AccessibleInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  helperText?: string
  error?: string
  fullWidth?: boolean
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  function AccessibleInput(
    {
      label,
      helperText,
      error,
      fullWidth = true,
      id,
      className = '',
      ...props
    },
    ref
  ) {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`
    const hasError = Boolean(error)

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
        >
          {label}
          {props.required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>

        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          className={`
            w-full px-4 py-3 min-h-[44px]
            bg-[var(--color-surface)] border rounded-lg
            text-[var(--color-text)] text-sm
            placeholder:text-[var(--color-text-muted)]
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${hasError
              ? 'border-[var(--color-error)] focus:ring-[var(--color-error)]/50'
              : 'border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]/30'
            }
            ${className}
          `.trim().replace(/\s+/g, ' ')}
          {...props}
        />

        {hasError && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-sm text-[var(--color-text-muted)]">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

/**
 * ================================================
 * ACCESSIBLE CARD COMPONENT
 * ================================================
 * Features:
 * - Proper structure with semantic markup
 * - Focus and hover states
 * - Touch-friendly sizing
 */

interface AccessibleCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  as?: 'div' | 'article' | 'section'
  highlighted?: boolean
}

export function AccessibleCard({
  children,
  className = '',
  onClick,
  as: Component = 'div',
  highlighted = false,
}: AccessibleCardProps) {
  const isInteractive = Boolean(onClick)

  return (
    <Component
      className={`
        p-5 rounded-xl
        bg-[var(--color-panel)] border
        ${highlighted
          ? 'border-[var(--color-accent)]/30 bg-gradient-to-b from-[var(--color-accent-dim)]'
          : 'border-[var(--color-border)]'
        }
        ${isInteractive ? 'cursor-pointer transition-all duration-200 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-elevated)]' : ''}
        focus-within:ring-2 focus-within:ring-[var(--color-accent)]/30
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      onClick={onClick}
      {...(isInteractive ? { role: 'button', tabIndex: 0 } : {})}
      {...(isInteractive ? {
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        }
      } : {})}
    >
      {children}
    </Component>
  )
}

/**
 * ================================================
 * ACCESSIBLE TOUCH TARGET WRAPPER
 * ================================================
 * Purpose: Ensures any interactive element meets 44x44px minimum
 */

interface TouchTargetWrapperProps {
  children: React.ReactNode
  className?: string
}

export function TouchTargetWrapper({ children, className = '' }: TouchTargetWrapperProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-h-[44px] min-w-[44px]
        ${className}
      `.trim()}
    >
      {children}
    </span>
  )
}

/**
 * ================================================
 * RESPONSIVE TABLE WRAPPER
 * ================================================
 * Features:
 * - Horizontal scroll on mobile
 * - Gradient hints for scrollable content
 * - Accessible scroll indicators
 */

interface ResponsiveTableWrapperProps {
  children: React.ReactNode
  minWidth?: string
}

export function ResponsiveTableWrapper({ children, minWidth = '640px' }: ResponsiveTableWrapperProps) {
  return (
    <div className="relative">
      {/* Right gradient hint for scrollable content - desktop hint */}
      <div
        className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent pointer-events-none z-10"
        aria-hidden="true"
      />

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent">
        <table className="w-full text-left" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  )
}

/**
 * ================================================
 * VISUALLY HIDDEN (SR-ONLY) COMPONENT
 * ================================================
 * Purpose: Screen reader only text for accessibility
 */

interface VisuallyHiddenProps {
  children: React.ReactNode
  className?: string
}

export function VisuallyHidden({ children, className = '' }: VisuallyHiddenProps) {
  return (
    <span className={`sr-only ${className}`}>
      {children}
    </span>
  )
}
