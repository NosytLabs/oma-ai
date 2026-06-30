'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { FadeIn, StaggerReveal } from '@/lib/motion'
import { ModelCard, type ModelLogo } from './ModelCard'

type FeaturedModel = {
  id: string
  provider: string
  ctx: string
  logo: ModelLogo
  inputPricePer1M: number
  outputPricePer1M: number
}

export function ModelsShowcase({ featuredModels }: { featuredModels: FeaturedModel[] }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <FadeIn className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
              Frontier models. <span className="text-accent">One endpoint.</span>
            </h2>
            <p className="mt-3 text-text-secondary text-sm sm:text-base">
              Switch models by changing the model ID. Same auth, same response format, same bill.
            </p>
          </div>
          <Link
            href="/models"
            className="inline-flex items-center gap-1.5 text-sm text-text-bright hover:text-accent transition-colors"
          >
            Browse all models
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </FadeIn>

        <StaggerReveal
          stagger={0.06}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          {featuredModels.map((m, i) => (
            <ModelCard key={m.id} model={m} rank={i} />
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}
