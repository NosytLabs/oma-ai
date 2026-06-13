'use client'

import { useEffect, useState, useId } from 'react'
import { NAV_ITEMS, NavItem } from '../data'

export function TableOfContents({ activeSectionId }: { activeSectionId: string }) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const navId = useId()

  const section: NavItem | undefined = NAV_ITEMS.find((n) => n.id === activeSectionId)

  useEffect(() => {
    setActiveHeadingId(null)
    if (!section || section.headings.length === 0) return

    const targets: HTMLElement[] = []
    section.headings.forEach((h) => {
      const el = document.getElementById(h.id)
      if (el) targets.push(el)
    })

    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveHeadingId(visible[0].target.id)
      },
      { rootMargin: '-30% 0px -65% 0px' }
    )

    targets.forEach((t) => observer.observe(t))
    return () => observer.disconnect()
  }, [section])

  if (!section || section.headings.length === 0) {
    return (
      <nav aria-label="On this page" className="text-xs text-[var(--color-text-muted)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          On this page
        </p>
        <p className="mt-3 text-[var(--color-text-tertiary)]">No sub-sections here.</p>
      </nav>
    )
  }

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        <span className="h-px w-3 bg-[var(--color-border-bright)]" aria-hidden="true" />
        On this page
      </p>
      <ul id={navId} className="space-y-0.5 border-l border-[var(--color-border)]">
        {section.headings.map((h) => {
          const isActive = activeHeadingId === h.id
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={`-ml-px block border-l-2 py-1 pl-3 pr-2 text-xs leading-snug transition-colors ${
                  isActive
                    ? 'border-[var(--color-accent)] font-medium text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border-bright)] hover:text-[var(--color-text)]'
                }`}
                aria-current={isActive ? 'true' : undefined}
              >
                {h.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
