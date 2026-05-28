'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

export function createLazyComponent<T>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  loadingHeight = 'h-[300px]'
) {
  return dynamic(importFn, {
    ssr: false,
    loading: () => <Skeleton className={`w-full ${loadingHeight}`} />
  })
}

export function createLazyClientComponent<T>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  loadingHeight = 'h-[300px]'
) {
  return dynamic(importFn, {
    ssr: false,
    loading: () => <Skeleton className={`w-full ${loadingHeight}`} />
  })
}