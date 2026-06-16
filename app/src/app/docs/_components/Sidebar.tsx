'use client'

import { useState, useId, useMemo, useRef, useEffect } from 'react'
import { Terminal, Menu, X, Search } from 'lucide-react'
import { NAV_ITEMS, filterNav } from '../data'

export function Sidebar({ activeId }: { activeId: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const mobileNavId = useId()
  const searchId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => filterNav(query, NAV_ITEMS), [query])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-void shadow-lg shadow-accent-glow transition-transform hover:scale-105 active:scale-95 lg:hidden"
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen}
        aria-controls={mobileNavId}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-void/80 backdrop-blur-sm lg:hidden cursor-default"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        id={mobileNavId}
        aria-label="Documentation navigation"
        className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-border bg-void transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
          <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent" />
              <span className="font-mono text-sm font-semibold text-accent">OMA API</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-text-muted">v1.0.0 · OpenAI-compatible</p>
          </div>

          <div className="mb-4">
            <label htmlFor={searchId} className="sr-only">Search documentation</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                ref={inputRef}
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs…"
                className="w-full rounded-lg border border-border bg-surface/60 py-2 pl-8 pr-12 font-mono text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-dim"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 inline-flex h-5 -translate-y-1/2 items-center rounded border border-border bg-surface-elevated px-1.5 font-mono text-[10px] text-text-muted">
                ⌘K
              </kbd>
            </div>
            {query && (
              <p className="mt-2 px-1 font-mono text-[11px] text-text-muted">
                {filtered.length} of {NAV_ITEMS.length} sections
              </p>
            )}
          </div>

          <nav className="space-y-1" aria-label="Documentation sections">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center font-mono text-xs text-text-muted">
                Nothing matches “{query}”.
              </p>
            ) : (
              filtered.map((item) => {
                const Icon = item.icon
                const isActive = activeId === item.id
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm transition-all ${
                      isActive
                        ? 'border-accent/30 bg-accent/10 font-medium text-accent'
                        : 'text-text-muted hover:border-border hover:bg-surface hover:text-text'
                    }`}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    )}
                  </a>
                )
              })
            )}
          </nav>

          <div className="mt-6 border-t border-border pt-4">
            <p className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
              Resources
            </p>
            <div className="mt-2 space-y-1">
              <a
                href="/playground"
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm text-text-muted transition-all hover:border-border hover:bg-surface hover:text-text"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                Playground
              </a>
              <a
                href="/pricing"
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm text-text-muted transition-all hover:border-border hover:bg-surface hover:text-text"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
                Pricing
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
