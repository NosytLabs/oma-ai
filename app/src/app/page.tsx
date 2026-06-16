import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthNotice } from '@/components/AuthNotice'
import HomeClient, { type HomeClientProps } from './_components/HomeClient'
import { MODEL_COUNT, MODELS, getProviderLogo } from '@/lib/models-data'

export const metadata: Metadata = {
  title: 'OMA · One key for every model',
  description:
    'Pay per request in USDC. No subscriptions. No rate limits. 17+ AI models, one OpenAI-compatible API. No account, no card, no sales call.',
  openGraph: {
    title: 'OMA · One key for every model',
    description:
      'Pay per request in USDC. No subscriptions. No rate limits. 17+ AI models behind one OpenAI-compatible API.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
}

const FEATURED_IDS = [
  'llama-3.3-70b',
  'claude-sonnet-4',
  'gemini-2.5-pro',
  'gpt-4o-mini',
  'deepseek-v3.2',
  'claude-3-5-haiku-latest',
] as const

function buildFeaturedModels(): HomeClientProps['featuredModels'] {
  return FEATURED_IDS.map((id) => {
    const m = MODELS.find((x) => x.id === id)
    return {
      id,
      provider: m?.provider ?? 'Unknown',
      ctx: m?.contextLength ?? '—',
      logo: m ? getProviderLogo(m.provider) : 'llama',
      inputPricePer1M: m?.inputPricePer1M ?? 0,
      outputPricePer1M: m?.outputPricePer1M ?? 0,
    }
  })
}

export default function HomePage() {
  const featuredModels = buildFeaturedModels()
  return (
    <>
      <Suspense fallback={null}>
        <AuthNotice />
      </Suspense>
      <HomeClient
        liveModelCount={MODEL_COUNT}
        featuredModels={featuredModels}
      />
    </>
  )
}
