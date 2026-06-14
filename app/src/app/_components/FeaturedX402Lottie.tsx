'use client'

/**
 * FeaturedX402Lottie — client-only loader for the x402 payment-flow
 * Lottie animation on the landing page.
 *
 * Uses the mounted-state pattern (not next/dynamic with ssr:false) so the
 * server can render the layout/skeleton while the Lottie JSON loads
 * client-side. The page.tsx is a server component that exports metadata,
 * so any next/dynamic(ssr:false) at this depth still triggers a
 * BAILOUT_TO_CLIENT_SIDE_RENDERING error during the root render pass.
 *
 * The mount gate keeps SSR stable: the server renders the placeholder
 * div, hydration runs the LottiePlayer client-side, animation begins.
 */

import { useEffect, useState } from 'react'
import { LottiePlayer } from '@/components/LottiePlayer'

export function FeaturedX402Lottie() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="w-full h-auto min-h-[200px]" aria-label="x402 payment flow animation container">
      {mounted ? (
        <LottiePlayer
          src="/lottie-x402-flow.json"
          ariaLabel="x402 payment flow animation: client posts a request, OMA returns 402 with Pay-Req, client pays USDC on Base, client retries with PAYMENT-SIGNATURE header, OMA verifies, settles, and streams the response."
          className="w-full h-auto"
        />
      ) : (
        <div
          className="w-full h-auto min-h-[200px] bg-[var(--color-surface)] border border-[var(--color-border)]"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
