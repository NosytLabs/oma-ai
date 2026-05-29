'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Code2, Zap, Lock, Globe, Sparkles, Terminal, Copy, Check } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const devCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.oma-ai.com/v1",
  apiKey: process.env.OMA_API_KEY,
});

const response = await client.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(response.choices[0].message);`

function CodeBlock() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(devCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-[var(--color-accent)]/10 via-[var(--color-success)]/5 to-[var(--color-accent)]/10 rounded-lg blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
      <div className="relative bg-[var(--color-void)] border border-[var(--color-border)] rounded-lg overflow-hidden shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--color-error)]/60" />
            <div className="w-3 h-3 rounded-full bg-[var(--color-secondary)]/60" />
            <div className="w-3 h-3 rounded-full bg-[var(--color-success)]/60" />
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-mono">
            <Terminal className="w-3.5 h-3.5" />
            <span>quick-start.ts</span>
          </div>
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy code'}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="p-5 text-sm font-mono text-[var(--color-text-secondary)] overflow-x-auto leading-relaxed">
          <code>{devCode}</code>
        </pre>
      </div>
    </div>
  )
}

const features = [
  { icon: Code2, text: 'OpenAI-compatible' },
  { icon: Zap, text: '50+ Models' },
  { icon: Lock, text: 'Privacy-first' },
  { icon: Globe, text: 'Global edge' },
]

function FeatureBadge({ feature }: { feature: typeof features[0] }) {
  const Icon = feature.icon
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-elevated)] transition-all duration-300" role="presentation">
      <Icon className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{feature.text}</span>
    </div>
  )
}

function AnimatedStatCounter({
  value,
  suffix,
  label,
  isVisible,
  delay = 0,
  reducedMotion = false,
}: {
  value: number
  suffix: string
  label: string
  isVisible: boolean
  delay?: number
  reducedMotion?: boolean
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible) return
    if (reducedMotion) {
      setCount(value)
      return
    }
    
    let startTime: number
    let animationFrame: number
    const duration = 2000

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * value))
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    setTimeout(() => {
      animationFrame = requestAnimationFrame(animate)
    }, delay)

    return () => cancelAnimationFrame(animationFrame)
  }, [isVisible, value, delay, reducedMotion])

  return (
    <div
      className={`flex flex-col items-center p-4 rounded border border-[var(--color-border)] bg-[var(--color-surface)] transition-all ${reducedMotion ? 'duration-0' : 'duration-500'} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: reducedMotion ? '0ms' : `${delay}ms` }}
    >
      <div className="text-2xl md:text-3xl font-mono font-bold text-[var(--color-text)]">
        <span>{count.toLocaleString()}</span>
        <span className="text-[var(--color-accent)]">{suffix}</span>
      </div>
      <div className="text-xs text-[var(--color-text-muted)] mt-1 font-mono">{label}</div>
    </div>
  )
}

function LivePricingTicker({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const prices = [
    { model: 'GPT-4o', price: '$2.50' },
    { model: 'Claude 4', price: '$3.00' },
    { model: 'DeepSeek R1', price: '$0.55' },
    { model: 'Llama 4', price: '$0.30' },
  ]

  return (
    <div className="flex items-center gap-3 overflow-hidden py-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 shrink-0">
        <div className={`w-2 h-2 rounded-full bg-[var(--color-success)] ${reducedMotion ? '' : 'animate-pulse'}`} />
        <span className="text-[10px] font-bold text-[var(--color-success)] uppercase tracking-widest font-mono">Live</span>
      </div>
      <div className="flex items-center gap-4 overflow-hidden">
        {prices.map((p) => (
          <div key={p.model} className="flex items-center gap-2 text-xs whitespace-nowrap font-mono">
            <span className="font-medium text-[var(--color-text-secondary)]">{p.model}</span>
            <span className="text-[var(--color-accent)] font-semibold">{p.price}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs whitespace-nowrap font-mono">
          <span className="font-medium text-[var(--color-text-muted)]">/1M tokens</span>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const [mounted, setMounted] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const heroRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotionState = usePrefersReducedMotion()
  const prefersReducedMotion = prefersReducedMotionState ?? false

  useEffect(() => {
    setMounted(true)

    let lastUpdate = 0
    const handleMouseMove = (e: MouseEvent) => {
      // Throttle to 20fps (50ms) to prevent performance issues
      const now = Date.now()
      if (now - lastUpdate < 50) return
      lastUpdate = now
      
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect()
        setMousePos({
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisible(true)
      },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center pt-24 pb-16 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-[var(--color-void)]" />

      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(0, 255, 200, 0.08) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255, 184, 0, 0.05) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(0, 255, 200, 0.03) 0%, transparent 60%)',
        }}
      />

      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(0, 255, 200, 0.15) 0%, transparent 50%)`,
        }}
      />

      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[var(--color-accent)]/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-[var(--color-secondary)]/5 rounded-full blur-[120px] pointer-events-none" />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0, 255, 200, 0.04) 1px, transparent 0)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="mx-auto max-w-6xl relative z-10">
        <div className={`transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-1000'} ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="text-sm font-medium text-[var(--color-accent)] font-mono">50+ models, instant global access</span>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 hover:bg-[var(--color-secondary)]/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
            >
              <span className="text-sm font-medium text-[var(--color-secondary)] font-mono">Credits-based pricing</span>
            </Link>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-syne font-bold tracking-tight mb-8 leading-[1.05]">
            <span className="text-[var(--color-accent)]">ONE MAN ARMY</span>
            <br />
            <span className="text-[var(--color-text)]">50+ Models. Zero Lock-in.</span>
          </h1>

          <p className="max-w-2xl text-xl md:text-2xl text-[var(--color-text-secondary)] leading-relaxed mb-6">
            One API. Every model. Pay with crypto. Route seamlessly between OpenAI, Anthropic, Meta, and open-source models.
          </p>

          <LivePricingTicker reducedMotion={prefersReducedMotion} />

          <div className="flex flex-wrap gap-3 mb-12 mt-6">
            {features.map((feature) => (
              <FeatureBadge key={feature.text} feature={feature} />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 sm:gap-5">
            <Link
              href="/docs"
              aria-label="Get API Key - Read documentation"
              className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 shadow-lg shadow-[var(--color-accent)]/20 hover:shadow-[var(--color-accent)]/30 text-center sm:text-left min-h-[48px] flex items-center justify-center"
            >
              <Terminal className="w-5 h-5 mr-2" />
              Get API Key
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="/playground"
              aria-label="Try the Playground"
              className="btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 text-center sm:text-left min-h-[48px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
            >
              Try Playground
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>

        <div
          ref={statsRef}
          className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '200ms' }}
        >
          <AnimatedStatCounter value={2847231} suffix="" label="Total Requests" isVisible={statsVisible} delay={0} reducedMotion={prefersReducedMotion} />
          <AnimatedStatCounter value={99.9} suffix="%" label="Uptime" isVisible={statsVisible} delay={100} reducedMotion={prefersReducedMotion} />
          <AnimatedStatCounter value={50} suffix="+" label="Models" isVisible={statsVisible} delay={200} reducedMotion={prefersReducedMotion} />
          <AnimatedStatCounter value={3} suffix="" label="Providers" isVisible={statsVisible} delay={300} reducedMotion={prefersReducedMotion} />
        </div>

        <div
          className={`mt-20 transition-all ${prefersReducedMotion ? 'duration-0 delay-0' : 'duration-1000 delay-300'} ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/50 to-transparent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] font-mono">Quick start</span>
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/50 to-transparent" />
          </div>
          <CodeBlock />

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group p-6 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-elevated)] transition-all duration-300">
              <div className="w-11 h-11 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 flex items-center justify-center mb-4 group-hover:border-[var(--color-accent)]/40 transition-colors">
                <Zap className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Fast Setup</h3>
              <p className="text-sm text-[var(--color-text-muted)]">OpenAI SDK compatible. Drop-in replacement in minutes.</p>
            </div>
            <div className="group p-6 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-success)]/30 hover:bg-[var(--color-surface-elevated)] transition-all duration-300">
              <div className="w-11 h-11 rounded border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 flex items-center justify-center mb-4 group-hover:border-[var(--color-success)]/40 transition-colors">
                <Lock className="w-5 h-5 text-[var(--color-success)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Privacy First</h3>
              <p className="text-sm text-[var(--color-text-muted)]">No tracking. No data collection. Your queries stay private.</p>
            </div>
            <div className="group p-6 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-secondary)]/30 hover:bg-[var(--color-surface-elevated)] transition-all duration-300">
              <div className="w-11 h-11 rounded border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 flex items-center justify-center mb-4 group-hover:border-[var(--color-secondary)]/40 transition-colors">
                <Globe className="w-5 h-5 text-[var(--color-secondary)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Global Edge</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Low-latency inference from edge locations worldwide.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}