'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowLeft, Home, Search } from 'lucide-react'
import { NotFoundLottie } from './_components/NotFoundLottie'

export default function NotFound() {
  useEffect(() => {
    // Log 404 for monitoring
    if (process.env.NODE_ENV === 'production') {
      console.warn('[404] Page not found:', window.location.pathname)
    }
  }, [])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <NotFoundLottie />

        <div className="mb-6 animate-fade-in">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-2 font-mono">
            {'>'} system_fault
          </p>
          <h1 className="text-2xl font-bold text-[var(--color-text-bright)] mb-3">
            Route Not Found
          </h1>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            The requested resource could not be located in our inference network. 
            Please verify the endpoint or return to the homepage.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-primary"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
          <Link
            href="/docs"
            className="btn-secondary"
          >
            <Search className="h-4 w-4" />
            Browse Docs
          </Link>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--color-border)]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to previous page</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
