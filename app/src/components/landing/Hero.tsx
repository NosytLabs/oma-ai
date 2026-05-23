'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Code2, Zap, Lock, Globe, Sparkles, Terminal, Copy, Check } from 'lucide-react'

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
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
      <div className="relative bg-zinc-950/95 border border-zinc-800/60 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Terminal className="w-3.5 h-3.5" />
            <span>quick-start.ts</span>
          </div>
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy code'}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800/50 rounded transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="p-5 text-sm font-mono text-zinc-300 overflow-x-auto leading-relaxed">
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
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm hover:border-cyan-500/30 hover:bg-zinc-900/80 transition-all duration-300">
      <Icon className="w-4 h-4 text-cyan-400" />
      <span className="text-sm font-medium text-zinc-300">{feature.text}</span>
    </div>
  )
}

function AnimatedStatCounter({
  value,
  suffix,
  label,
  isVisible,
  delay = 0,
}: {
  value: number
  suffix: string
  label: string
  isVisible: boolean
  delay?: number
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible) return
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
  }, [isVisible, value, delay])

  return (
    <div
      className={`flex flex-col items-center p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="text-2xl md:text-3xl font-bold text-white">
        <span>{count.toLocaleString()}</span>
        <span className="text-cyan-400">{suffix}</span>
      </div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}

function LivePricingTicker() {
  const prices = [
    { model: 'GPT-4o', price: '$2.50' },
    { model: 'Claude 4', price: '$3.00' },
    { model: 'DeepSeek R1', price: '$0.55' },
    { model: 'Llama 4', price: '$0.30' },
  ]

  return (
    <div className="flex items-center gap-3 overflow-hidden py-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
      </div>
      <div className="flex items-center gap-4 overflow-hidden">
        {prices.map((p) => (
          <div key={p.model} className="flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="font-medium text-zinc-400">{p.model}</span>
            <span className="text-cyan-400 font-mono font-semibold">{p.price}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="font-medium text-zinc-400">/1M tokens</span>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const [mounted, setMounted] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [videoLoaded, setVideoLoaded] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)

    const handleMouseMove = (e: MouseEvent) => {
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
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950" />

      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(0, 255, 200, 0.08) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255, 184, 0, 0.05) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(0, 255, 200, 0.03) 0%, transparent 60%)',
        }}
      />

      <video
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? 'opacity-40' : 'opacity-0'} z-0`}
      >
        <source src="https://res.cloudinary.com/dfonotyfb/video/upload/v1775585556/dds3_1_rqhg7x.mp4" type="video/mp4" />
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260505_105838_084968f2-4415-42a4-971a-3bec54539549.mp4" type="video/mp4" />
      </video>

      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(0, 255, 200, 0.15) 0%, transparent 50%)`,
        }}
      />

      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0, 255, 200, 0.06) 1px, transparent 0)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="mx-auto max-w-6xl relative z-10">
        <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">50+ models, instant global access</span>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm hover:bg-amber-500/20 transition-colors"
            >
              <span className="text-sm font-medium text-amber-300">Credits-based pricing</span>
            </Link>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight mb-8 leading-[1.05]">
            <span className="text-white">The AI Gateway</span>
            <br />
            <span className="gradient-text">Built for Builders</span>
          </h1>

          <p className="max-w-2xl text-xl md:text-2xl text-zinc-400 leading-relaxed mb-6">
            One API. Every model. Pay with crypto. Route seamlessly between OpenAI, Anthropic, Meta, and open-source models.
          </p>

          <LivePricingTicker />

          <div className="flex flex-wrap gap-3 mb-12 mt-6">
            {features.map((feature) => (
              <FeatureBadge key={feature.text} feature={feature} />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 sm:gap-5">
            <Link
              href="/docs"
              className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 text-center sm:text-left min-h-[48px] flex items-center justify-center"
            >
              <Terminal className="w-5 h-5 mr-2" />
              Get API Key
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="/playground"
              className="btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 text-center sm:text-left min-h-[48px] flex items-center justify-center"
            >
              Try Playground
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>

        <div
          ref={statsRef}
          className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <AnimatedStatCounter value={2847231} suffix="" label="Total Requests" isVisible={statsVisible} delay={0} />
          <AnimatedStatCounter value={99.9} suffix="%" label="Uptime" isVisible={statsVisible} delay={100} />
          <AnimatedStatCounter value={50} suffix="+" label="Models" isVisible={statsVisible} delay={200} />
          <AnimatedStatCounter value={3} suffix="" label="Providers" isVisible={statsVisible} delay={300} />
        </div>

        <div
          className={`mt-20 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Quick start</span>
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          </div>
          <CodeBlock />

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm hover:border-cyan-500/30 hover:bg-zinc-900/60 transition-all duration-300">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 group-hover:border-cyan-500/40 transition-colors">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Fast Setup</h3>
              <p className="text-sm text-zinc-500">OpenAI SDK compatible. Drop-in replacement in minutes.</p>
            </div>
            <div className="group p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm hover:border-emerald-500/30 hover:bg-zinc-900/60 transition-all duration-300">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:border-emerald-500/40 transition-colors">
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Privacy First</h3>
              <p className="text-sm text-zinc-500">No tracking. No data collection. Your queries stay private.</p>
            </div>
            <div className="group p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm hover:border-amber-500/30 hover:bg-zinc-900/60 transition-all duration-300">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:border-amber-500/40 transition-colors">
                <Globe className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Global Edge</h3>
              <p className="text-sm text-zinc-500">Low-latency inference from edge locations worldwide.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}