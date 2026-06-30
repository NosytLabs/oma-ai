'use client'

import { X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { m } from 'framer-motion'

export type AlertBannerVariant = 'error' | 'success'

export type AlertBannerProps = {
  variant: AlertBannerVariant
  title?: string
  message: string
  onDismiss?: () => void
}

const variantClasses: Record<AlertBannerVariant, string> = {
  error: 'border-error/30 bg-error/10 text-error',
  success: 'border-success/30 bg-success-dim text-success',
}

const variantIcons: Record<AlertBannerVariant, typeof AlertTriangle> = {
  error: AlertTriangle,
  success: CheckCircle2,
}

const variantRole: Record<AlertBannerVariant, string> = {
  error: 'alert',
  success: 'status',
}

export function AlertBanner({ variant, title, message, onDismiss }: AlertBannerProps) {
  const Icon = variantIcons[variant]

  return (
    <m.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      role={variantRole[variant]}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 p-4 rounded border ${variantClasses[variant]}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-bold font-mono mb-1">{title}</p>}
        <p className="text-sm font-mono">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="flex-shrink-0 p-1 rounded hover:bg-accent/10 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </m.div>
  )
}
