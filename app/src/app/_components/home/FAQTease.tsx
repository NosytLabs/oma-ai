'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FadeIn } from '@/lib/motion'
import { AccordionItem } from '@/components/ui/AccordionItem'

const FAQ_TEASE_ITEMS = [
  {
    q: 'Do I need an account to use OMA?',
    a: 'No. Generate a 16-digit anonymous account number in one click, no KYC, no email, no PII. Or connect a wallet. Or use x402 for per-request pay-as-you-go with no account at all. Your choice.',
  },
  {
    q: 'How is OMA different from Venice AI?',
    a: 'Anonymous by design. 16-digit account numbers and private inference exclusively through Venice AI. One endpoint, one bill, one auth flow. Zero data retention on every request.',
  },
  {
    q: 'What is x402 and do I have to use it?',
    a: 'x402 is an open HTTP-native payment standard. Skip login entirely. Pay per request with a single signature. No account, no wallet, no JWT. Best for agents and one-off calls.',
  },
  {
    q: 'What happens if I run out of credits mid-request?',
    a: 'You get a 402 with a Pay-Req header. If your client handles 402, it pays and retries inline. Otherwise, top up and retry. Same model, same endpoint, no rate limit.',
  },
] as const

export function FAQTease() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <FadeIn className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
              Quick answers. <span className="text-accent">No fine print.</span>
            </h2>
          </div>
          <Link
            href="/faq"
            className="inline-flex items-center gap-1.5 text-sm text-text-bright hover:text-accent transition-colors"
          >
            Read the full FAQ
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </FadeIn>

        <FadeIn delay={0.08} className="rounded-xl border border-border bg-panel/40 divide-y divide-border overflow-hidden">
          {FAQ_TEASE_ITEMS.map((item, i) => (
            <AccordionItem
              key={item.q}
              id={`home-faq-${i}`}
              title={item.q}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            >
              {item.a}
            </AccordionItem>
          ))}
        </FadeIn>
      </div>
    </section>
  )
}
