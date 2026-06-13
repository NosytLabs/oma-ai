'use client'

import Link from 'next/link'
import { BookOpen, Play, Github } from 'lucide-react'

export function DocsHeader() {
  return (
    <header className="sticky top-16 z-30 border-b border-[var(--color-border)] bg-[var(--color-void)]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <nav
              aria-label="Breadcrumb"
              className="hidden items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)] sm:flex"
            >
              <Link href="/" className="transition-colors hover:text-[var(--color-text)]">
                home
              </Link>
              <span className="text-[var(--color-text-tertiary)]">/</span>
              <span className="text-[var(--color-text-secondary)]">developer-portal</span>
              <span className="text-[var(--color-text-tertiary)]">/</span>
              <span className="text-[var(--color-text)]">api-docs</span>
            </nav>
            <h1 className="truncate font-mono text-sm font-semibold text-[var(--color-text)]">
              OMA API reference
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://github.com/oma-ai/gateway"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3 py-1.5 font-mono text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-bright)] hover:text-[var(--color-text)] sm:inline-flex"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
          <Link
            href="/playground"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-void)] transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-[0_0_0_4px_var(--color-accent-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] sm:px-4 sm:py-2"
          >
            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Playground</span>
            <span className="sm:hidden">Try</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
