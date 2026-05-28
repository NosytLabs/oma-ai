'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

const ModelDetailModalLazy = dynamic(
  () => import('./ModelDetailModal').then(mod => mod.ModelDetailModal),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl h-[90vh] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
)

export { ModelDetailModalLazy as ModelDetailModal }
export type { Model } from '@/lib/models-data'