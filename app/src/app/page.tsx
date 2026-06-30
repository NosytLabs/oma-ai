import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthNotice } from '@/components/AuthNotice'
import HomeClient, { type HomeClientProps } from './_components/HomeClient'
import { MODEL_COUNT, MODELS, getProviderLogo } from '@/lib/models-data'

export const metadata: Metadata = {
  title: 'OMA · One key for every model',
  description:
    'Anonymous AI inference. No KYC, no email, no subscriptions. Pay per request in USDC. Mullvad-style account numbers and private inference through Venice. 17+ AI models, one OpenAI-compatible API.',
  openGraph: {
    title: 'OMA · One key for every model',
    description:
      'Anonymous AI inference. No KYC, no email, no subscriptions. Mullvad-style account numbers and private inference through Venice. Pay per request in USDC.',
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
