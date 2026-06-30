'use client'

import { RouteErrorFallback } from '@/components/ui/RouteErrorFallback'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AboutUsError({ error, reset }: ErrorPageProps) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      title="About Us Error"
      routeName="about_us"
    />
  )
}
