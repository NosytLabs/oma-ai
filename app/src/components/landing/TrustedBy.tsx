'use client'

import { useEffect, useRef, useState } from 'react'

interface LogoItem {
  name: string
  icon: string
  color: string
}

const logos: LogoItem[] = [
  { name: 'Vercel', icon: 'V', color: 'text-white' },
  { name: 'Stripe', icon: 'S', color: 'text-blue-400' },
  { name: 'Linear', icon: 'L', color: 'text-purple-400' },
  { name: 'Raycast', icon: 'R', color: 'text-orange-400' },
  { name: 'Planetscale', icon: 'P', color: 'text-blue-300' },
  { name: 'Supabase', icon: 'S', color: 'text-emerald-400' },
  { name: 'Resend', icon: 'R', color: 'text-pink-400' },
  { name: 'Dub', icon: 'D', color: 'text-amber-400' },
  { name: 'Cal.com', icon: 'C', color: 'text-cyan-400' },
  { name: 'Mintlify', icon: 'M', color: 'text-white' },
]

export function TrustedBy() {
  const [isVisible, setIsVisible] = useState(false)
  const [scrollPos, setScrollPos] = useState(0)
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

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setScrollPos((prev) => (prev + 1) % (logos.length * 2))
    }, 50)

    return () => clearInterval(interval)
  }, [isVisible])

  return (
    <section ref={ref} className="relative py-24 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-zinc-950" />

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
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-600 mb-4">
            Trusted by developers at
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-400">
            Building the future of AI
          </h2>
        </div>

        <div
          className={`relative overflow-hidden transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            <div
              className="flex gap-4"
              style={{
                transform: `translateX(-${scrollPos * 4}px)`,
                transition: 'transform 50ms linear',
              }}
            >
              {[...logos, ...logos, ...logos].map((logo, i) => (
                <div
                  key={`${logo.name}-${i}`}
                  className="flex items-center gap-3 px-6 py-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shrink-0"
                >
                  <div
                    className={`w-10 h-10 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center ${logo.color}`}
                  >
                    <span className="text-lg font-bold">{logo.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-400">{logo.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-600 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          {[
            { value: '10K+', label: 'Active Developers' },
            { value: '50M+', label: 'API Calls Processed' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '24/7', label: 'Global Support' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  )
}