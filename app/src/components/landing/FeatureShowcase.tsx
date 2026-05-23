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

function FeatureCard({
  feature,
  index,
  isVisible,
}: {
  feature: Feature
  index: number
  isVisible: boolean
}) {
  const Icon = feature.icon
  return (
    <div
      className={`group relative p-6 rounded-2xl bg-zinc-900/50 border backdrop-blur-sm transition-all duration-500 hover:bg-zinc-900/80 ${
        feature.accent
          ? 'border-cyan-500/30 hover:border-cyan-500/50'
          : 'border-zinc-800/50 hover:border-zinc-700/50'
      } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div
        className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${
          feature.accent ? 'bg-gradient-to-br from-cyan-500/5 to-transparent' : ''
        }`}
      />

      <div className="relative">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors ${
            feature.accent
              ? 'bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 group-hover:border-cyan-500/40'
              : 'bg-zinc-800/50 border border-zinc-700/50 group-hover:border-zinc-600/50'
          }`}
        >
          <Icon
            className={`w-6 h-6 ${
              feature.accent ? 'text-cyan-400' : 'text-zinc-400 group-hover:text-zinc-300'
            } transition-colors`}
          />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
          {feature.accent && (
            <ArrowUpRight className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
      </div>
    </div>
  )
}

function FeatureShowcaseHeader() {
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
    <div
      ref={ref}
      className={`text-center mb-12 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
        <Zap className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-cyan-300">Developer-First Design</span>
      </div>
      <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
        Everything you need to build
      </h2>
      <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
        Production-ready features designed for scale. From startup to enterprise.
      </p>
    </div>
  )
}

export function FeatureShowcase() {
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
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/30 to-zinc-950" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <FeatureShowcaseHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} isVisible={isVisible} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {additionalFeatures.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={features.length + i}
              isVisible={isVisible}
            />
          ))}
        </div>

        <div
          className={`mt-12 p-8 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-amber-500/5 border border-cyan-500/20 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '700ms' }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-semibold text-white mb-2">Ready to start building?</h3>
              <p className="text-zinc-500">
                Get your API key in seconds and start making requests.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                <span className="text-sm text-zinc-400">Free tier includes</span>
                <span className="text-cyan-400 font-semibold ml-1">1M tokens/mo</span>
              </div>
              <a
                href="/docs"
                className="btn-primary text-sm px-6 py-3"
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