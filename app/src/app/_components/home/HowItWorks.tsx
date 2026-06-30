'use client'

import { m } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Wallet } from 'lucide-react'
import {
  EASE_SPRING,
  FadeIn,
  StaggerReveal,
  scaleInSpringSafe,
} from '@/lib/motion'

const STEPS = [
  { n: '1', t: 'Get access', d: 'Generate a 16-digit account number, connect a wallet, or use x402 pay-per-request. No KYC, no email needed.' },
  { n: '2', t: 'Add credits', d: 'Send USDC, swap from any token, or use x402 gasless payments.' },
  { n: '3', t: 'Start building', d: 'Call any model with one OpenAI-compatible request.' },
] as const

export function HowItWorks() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text-bright tracking-tight leading-tight">
            Three steps. <span className="text-accent">Thirty seconds.</span>
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto text-sm sm:text-base">
            Generate an anonymous account number, connect a wallet, or use
            x402 pay-per-request. Top up with USDC and start calling AI models
            in under a minute.
          </p>
        </FadeIn>

        <StaggerReveal
          stagger={0.14}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative"
        >
          {/* Connecting line + moving dot */}
          <div
            className="hidden md:block absolute top-6 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border to-transparent overflow-visible"
            aria-hidden="true"
          >
            <m.span
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent glow-accent-sm"
              initial={{ x: '-50%', opacity: 0 }}
              whileInView={{ x: '50%', opacity: [0, 1, 1, 0] }}
              viewport={{ once: true }}
              transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.3 }}
            />
          </div>
          {STEPS.map((s) => (
            <m.div
              key={s.n}
              variants={scaleInSpringSafe}
              className="relative text-center"
            >
              <div className="relative inline-flex items-center justify-center mb-4">
                <m.div
                  className="h-12 w-12 rounded-full bg-accent text-void text-lg font-bold flex items-center justify-center font-mono"
                  whileHover={{ scale: 1.08 }}
                  transition={EASE_SPRING}
                >
                  {s.n}
                </m.div>
              </div>
              <h3 className="text-lg font-semibold text-text-bright mb-2 tracking-tight">
                {s.t}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed max-w-[26ch] mx-auto">
                {s.d}
              </p>
            </m.div>
          ))}
        </StaggerReveal>

        <FadeIn delay={0.2} className="mt-12 text-center">
          <Link
            href="/deposit"
            className="inline-flex items-center gap-2 text-sm text-text-bright hover:text-accent transition-colors"
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Add credits to your account
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </FadeIn>
      </div>
    </section>
  )
}
