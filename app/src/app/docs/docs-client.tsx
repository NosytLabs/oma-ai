'use client'

import { useState, useEffect } from 'react'
import { NAV_ITEMS } from './data'
import { Sidebar } from './_components/Sidebar'
import { DocsHeader } from './_components/DocsHeader'
import { TableOfContents } from './_components/TableOfContents'
import { QuickStartSection } from './_components/QuickStartSection'
import { AuthenticationSection } from './_components/AuthenticationSection'
import { EndpointsSection } from './_components/EndpointsSection'
import { ModelsSection } from './_components/ModelsSection'
import { RateLimitsSection } from './_components/RateLimitsSection'
import { X402Section } from './_components/X402Section'
import { SDKsSection } from './_components/SDKsSection'
import { ErrorsSection } from './_components/ErrorsSection'

export function DocsClient() {
  const [activeId, setActiveId] = useState('quickstart')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px' }
    )
    NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen">
      <Sidebar activeId={activeId} />

      <div className="lg:pl-64">
        <DocsHeader />

        <div className="mx-auto flex max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:px-8">
          <main id="main-content" className="min-w-0 flex-1 max-w-4xl">
            <div className="mb-12">
              <p className="mb-4 inline-flex items-center gap-1.5 font-mono text-sm text-[var(--color-text-muted)]">
                <span className="text-[var(--color-accent)]">~/</span>
                <span className="text-[var(--color-text-tertiary)]">docs</span>
                <span
                  className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-[var(--color-accent)] animate-blink"
                  aria-hidden="true"
                />
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] font-syne mb-3 sm:text-5xl">
                OMA API reference
              </h1>
              <p className="text-lg leading-relaxed text-[var(--color-text-muted)] max-w-3xl">
                One endpoint, many models, paid per token. Drop in the OpenAI SDK and change the base URL, or skip accounts entirely and pay with a wallet.
              </p>
            </div>

            <div className="space-y-20">
              <QuickStartSection />
              <AuthenticationSection />
              <EndpointsSection />
              <ModelsSection />
              <RateLimitsSection />
              <X402Section />
              <SDKsSection />
              <ErrorsSection />
            </div>
          </main>

          <aside className="hidden w-56 shrink-0 xl:block">
            <div className="sticky top-24">
              <TableOfContents activeSectionId={activeId} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
