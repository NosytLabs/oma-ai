import { Suspense, lazy } from 'react'
import { Hero } from '@/components/landing/Hero'
import { TrustedBy } from '@/components/landing/TrustedBy'

import { Skeleton } from '@/components/ui/Skeleton'

const LazyHowItWorks = lazy(() => import('@/components/landing/HowItWorks').then(m => ({ default: m.HowItWorks })))
const LazyModelHighlights = lazy(() => import('@/components/landing/ModelHighlights').then(m => ({ default: m.ModelHighlights })))
const LazyFeatureShowcase = lazy(() => import('@/components/landing/FeatureShowcase').then(m => ({ default: m.FeatureShowcase })))
const LazyPricingTiers = lazy(() => import('@/components/landing/PricingTiers').then(m => ({ default: m.PricingTiers })))
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
        <LazyHowItWorks />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <LazyModelHighlights />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <LazyFeatureShowcase />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <LazyPricingTiers />
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