'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error for monitoring
    if (process.env.NODE_ENV === 'production') {
      console.error('[ErrorBoundary]', {
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      })
    }
  }, [error])

  const isKnownError = error.digest !== undefined
  const errorMessage = error.message || 'An unexpected system fault occurred'

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="mb-8 flex items-center justify-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--color-error)]/30 bg-[var(--color-error)]/10">
              <AlertTriangle className="h-10 w-10 text-[var(--color-error)]" />
            </div>
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-error)] text-xs font-bold text-white">
              !
            </span>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-2 font-mono">
            {'>'} system_interrupt
          </p>
          <h1 className="text-2xl font-bold text-[var(--color-text-bright)] mb-3">
            System Fault Detected
          </h1>
          <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm">
            {errorMessage}
          </p>
          {isKnownError && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)] font-mono">
              Error ID: {error.digest?.slice(0, 8)}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="btn-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Request
          </button>
          <Link
            href="/"
            className="btn-secondary"
          >
            <Home className="h-4 w-4" />
            Return Home
          </Link>
          <a
            href={`mailto:support@oma-ai.com?subject=${encodeURIComponent(`OMA Gateway bug report${error.digest ? ` (${error.digest.slice(0, 8)})` : ''}`)}&body=${encodeURIComponent(`Error: ${errorMessage}${error.digest ? `\nDigest: ${error.digest}` : ''}\n\nSteps to reproduce:\n1. \n\nExpected:\n\nActual:\n`)}`}
            className="btn-secondary"
          >
            <Bug className="h-4 w-4" />
            Report a Bug
          </a>
        </div>

        {process.env.NODE_ENV === 'development' && error.stack && (
          <details className="mt-8 text-left">
            <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text)] flex items-center gap-2">
              <Bug className="h-3 w-3" />
              Stack Trace
            </summary>
            <pre className="mt-3 p-4 bg-[var(--color-surface)] rounded border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] overflow-x-auto whitespace-pre-wrap">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
