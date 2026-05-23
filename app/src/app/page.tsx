import { Suspense, lazy } from 'react'
import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { ModelHighlights } from '@/components/landing/ModelHighlights'
import { PricingTiers } from '@/components/landing/PricingTiers'
import { FeatureShowcase } from '@/components/landing/FeatureShowcase'
import { TrustedBy } from '@/components/landing/TrustedBy'

import { Skeleton } from '@/components/ui/Skeleton'

const LazyForDevelopers = lazy(() => import('@/components/landing/ForDevelopers').then(m => ({ default: m.ForDevelopers })))
const LazyPricingPayments = lazy(() => import('@/components/landing/PricingPayments').then(m => ({ default: m.PricingPayments })))
const LazyCtaFooter = lazy(() => import('@/components/landing/CtaFooter').then(m => ({ default: m.CtaFooter })))

function SectionSkeleton() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <Suspense fallback={<SectionSkeleton />}>
        <HowItWorks />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <ModelHighlights />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <FeatureShowcase />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <PricingTiers />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <LazyForDevelopers />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <LazyPricingPayments />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <LazyCtaFooter />
      </Suspense>
    </>
  )
}