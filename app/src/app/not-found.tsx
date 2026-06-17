'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowLeft, Home, Search } from 'lucide-react'
import { NotFoundLottie } from './_components/NotFoundLottie'
import { log } from '@/lib/logger'

export default function NotFound() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      log.warn('[404] Page not found', { path: window.location.pathname })
    }
  }, [])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <NotFoundLottie className="mx-auto mb-6 w-40 sm:w-48" />

        <div className="mb-6 animate-fade-in">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-mono">
            {'>'} system_fault
          </p>
          <h1 className="h1-utility mb-3 text-text-bright">
            Route Not Found
          </h1>
          <p className="text-text-secondary leading-relaxed">
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

        <div className="mt-12 pt-6 border-t border-border">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to homepage</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
