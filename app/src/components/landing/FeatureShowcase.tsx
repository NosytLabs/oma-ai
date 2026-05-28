'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Route,
  DollarSign,
  Wifi,
  Zap,
  BarChart3,
  Shield,
  Globe,
  ArrowUpRight,
} from 'lucide-react'

interface Feature {
  icon: typeof Route
  title: string
  description: string
  accent?: boolean
}

const features: Feature[] = [
  {
    icon: Route,
    title: 'Multi-Provider Routing',
    description:
      'Automatically routes requests to the best-performing provider based on latency, cost, and availability.',
    accent: true,
  },
  {
    icon: DollarSign,
    title: 'Real-time Pricing',
    description:
      'Live token pricing across all providers. Always know exactly what you will pay before you call.',
  },
  {
    icon: Wifi,
    title: 'WebSocket Support',
    description:
      'Full streaming and Server-Sent Events support for real-time AI interactions in your applications.',
  },
  {
    icon: Zap,
    title: 'Streaming Responses',
    description:
      'Token-by-token streaming for instant responses. Built for chat interfaces and interactive apps.',
  },
  {
    icon: BarChart3,
    title: 'Usage Analytics',
    description:
      'Detailed dashboards tracking your API usage, costs by model, and performance metrics.',
    accent: true,
  },
  {
    icon: Shield,
    title: '99.9% Uptime SLA',
    description:
      'Enterprise-grade reliability with multi-provider failover. Your applications never stop.',
  },
]

const additionalFeatures: Feature[] = [
  {
    icon: Globe,
    title: 'Global Edge Network',
    description:
      'Low-latency inference from edge locations worldwide. 50+ regions for minimal ping times.',
  },
]

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean | null>(null)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return prefersReducedMotion
}

function FeatureCard({
  feature,
  index,
  isVisible,
  reducedMotion = false,
}: {
  feature: Feature
  index: number
  isVisible: boolean
  reducedMotion?: boolean
}) {
  const Icon = feature.icon
  return (
    <div
      className={`group relative p-6 rounded border backdrop-blur-sm transition-all ${reducedMotion ? 'duration-0' : 'duration-500'} hover:bg-[var(--color-surface-elevated)] ${
        feature.accent
          ? 'border-[var(--color-cyan)]/30 hover:border-[var(--color-cyan)]/50 bg-[var(--color-surface)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-bright)] bg-[var(--color-surface)]'
      } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: reducedMotion ? '0ms' : `${index * 100}ms` }}
    >
      <div
        className={`absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
          feature.accent ? 'bg-gradient-to-br from-[var(--color-cyan)]/5 to-transparent' : ''
        }`}
      />

      <div className="relative">
        <div
          className={`w-12 h-12 rounded flex items-center justify-center mb-5 transition-colors ${
            feature.accent
              ? 'border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/10 group-hover:border-[var(--color-cyan)]/40'
              : 'border border-[var(--color-border-bright)] bg-[var(--color-surface-elevated)]'
          }`}
        >
          <Icon
            className={`w-6 h-6 ${
              feature.accent ? 'text-[var(--color-cyan)]' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]'
            } transition-colors`}
          />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-syne font-semibold text-[var(--color-text)]">{feature.title}</h3>
          {feature.accent && (
            <ArrowUpRight className="w-4 h-4 text-[var(--color-cyan)] opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{feature.description}</p>
      </div>
    </div>
  )
}

function FeatureShowcaseHeader({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (reducedMotion) {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [reducedMotion])

  return (
    <div
      ref={ref}
      className={`text-center mb-12 transition-all ${reducedMotion ? 'duration-0' : 'duration-700'} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/10 mb-6">
        <Zap className="w-4 h-4 text-[var(--color-cyan)]" />
        <span className="text-sm font-medium text-[var(--color-cyan)] font-mono">Developer-First Design</span>
      </div>
      <h2 className="text-4xl md:text-5xl font-syne font-bold tracking-tight text-[var(--color-text)] mb-4">
        Everything you need to build
      </h2>
      <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
        Production-ready features designed for scale. From startup to enterprise.
      </p>
    </div>
  )
}

export function FeatureShowcase() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotionState = usePrefersReducedMotion()
  const prefersReducedMotion = prefersReducedMotionState ?? false

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (prefersReducedMotion) {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-[var(--color-void)]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[var(--color-cyan)]/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <FeatureShowcaseHeader reducedMotion={prefersReducedMotion} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} isVisible={isVisible} reducedMotion={prefersReducedMotion} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {additionalFeatures.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={features.length + i}
              isVisible={isVisible}
              reducedMotion={prefersReducedMotion}
            />
          ))}
        </div>

        <div
          className={`mt-12 p-8 rounded-lg border border-[var(--color-cyan)]/20 bg-[var(--color-surface)] transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '700ms' }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-syne font-semibold text-[var(--color-text)] mb-2">Ready to start building?</h3>
              <p className="text-[var(--color-text-muted)]">
                Get your API key in seconds and start making requests.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
                <span className="text-sm text-[var(--color-text-secondary)]">Free tier includes</span>
                <span className="text-[var(--color-cyan)] font-semibold ml-1">1M tokens/mo</span>
              </div>
              <a
                href="/docs"
                className="btn-primary text-sm px-6 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
              >
                Get API Key
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}