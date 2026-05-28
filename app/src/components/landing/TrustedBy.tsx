'use client'

import { useEffect, useRef, useState } from 'react'

const providers = [
  'Venice AI',
  'AntSeed',
  'OpenRouter',
  'Together AI',
  'Falcon',
  'Mistral',
]

export function TrustedBy() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative py-24 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-[var(--color-void)]" />

      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(0, 255, 200, 0.1) 0%, transparent 50%)',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4 font-mono">
            Routing across multiple AI providers
          </p>
          <h2 className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-[var(--color-text-secondary)]">
            ONE MAN ARMY
          </h2>
        </div>

        <div
          className={`flex flex-wrap items-center justify-center gap-4 md:gap-8 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          {providers.map((provider) => (
            <div
              key={provider}
              className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
              <span className="text-sm font-medium text-[var(--color-text-secondary)] font-mono">{provider}</span>
            </div>
          ))}
        </div>

        <div
          className={`mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-[var(--color-text-muted)] transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          {[
            { value: '50+', label: 'Models' },
            { value: '6', label: 'Providers' },
            { value: '<50ms', label: 'Failover' },
            { value: '100+', label: 'Assets' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-mono font-bold text-[var(--color-accent)]">{stat.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
