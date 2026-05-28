'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

const ChatMessageLazy = dynamic(
  () => import('./ChatMessage').then(mod => mod.ChatMessage),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-4">
        <Skeleton className="w-10 h-10 shrink-0 rounded" />
        <div className="flex flex-col max-w-[80%] gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    )
  }
)

const ChatMessage = ChatMessageLazy

export { ChatMessage }
export type { Message, SearchResult, ModelOption, TierFilter } from './ChatMessage'