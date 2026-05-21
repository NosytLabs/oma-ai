'use client'

import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { ModelHighlights } from '@/components/landing/ModelHighlights'
import { PricingPayments } from '@/components/landing/PricingPayments'
import { ForDevelopers } from '@/components/landing/ForDevelopers'
import { CtaFooter } from '@/components/landing/CtaFooter'

export default function LandingPage() {
  return (
    <div className="font-mono">
      <Hero />
      <HowItWorks />
      <ModelHighlights />
      <PricingPayments />
      <ForDevelopers />
      <CtaFooter />
    </div>
  )
}
