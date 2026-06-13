'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { X, AlertCircle } from 'lucide-react'
import { Message } from '@/components/playground'
import { Skeleton } from '@/components/ui/Skeleton'
import { CostEstimate } from '@/components/playground/MessageInput'

const LazyChatMessage = dynamic(
  () => import('@/components/playground/ChatMessage').then(mod => mod.ChatMessage),
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

const LazyMessageInput = dynamic(
  () => import('@/components/playground/MessageInput').then(mod => mod.MessageInput),
  { ssr: false, loading: () => <Skeleton className="h-16 w-full" /> }
)

const LazyEmptyState = dynamic(
  () => import('@/components/playground/PresetPrompts').then(mod => mod.EmptyState),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)

type Props = {
  deferredMessages: Message[]
  loading: boolean
  handleCopy: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  handleScroll: () => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  error: string | null
  setError: (err: string | null) => void
  input: string
  setInput: (input: string) => void
  sendMessage: () => void
  stopGeneration: () => void
  model: string
  handlePreset: (prompt: string) => void
}

export function PlaygroundChatArea({
  deferredMessages, loading, handleCopy, scrollContainerRef, handleScroll,
  messagesEndRef, error, setError, input, setInput, sendMessage, stopGeneration,
  model, handlePreset
}: Props) {
  return (
    <section aria-label="Chat messages" className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-border)] relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="max-w-4xl mx-auto">
          {deferredMessages.length === 0 ? (
            <LazyEmptyState onPreset={handlePreset} />
          ) : (
            <div className="space-y-8 pb-12">
              {deferredMessages.map((msg, index) => (
                <LazyChatMessage
                  key={`${msg.timestamp}-${index}`}
                  msg={msg}
                  loading={loading}
                  onCopy={handleCopy}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-none p-4 md:p-8 bg-[var(--color-void)] border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-3 flex items-center justify-between px-3 py-2 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[11px] text-[var(--color-error)] uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>ERR: {error}</span>
                {error.includes('API key') && (
                  <Link
                    href="/dashboard/api-keys"
                    className="ml-2 px-2 py-0.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    Get API Key →
                  </Link>
                )}
                {(error.includes('402') || error.toLowerCase().includes('payment') || error.toLowerCase().includes('credit')) && (
                  <Link
                    href="/deposit"
                    className="ml-2 px-2 py-0.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    Deposit Credits →
                  </Link>
                )}
              </div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-[var(--color-error)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <LazyMessageInput
            input={input}
            setInput={setInput}
            onSubmit={sendMessage}
            onStop={stopGeneration}
            loading={loading}
          />

          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">
              [ENTER] EXECUTE · [SHIFT+ENTER] NEWLINE
            </p>
            <CostEstimate inputText={input} model={model} />
          </div>
        </div>
      </div>
    </section>
  )
}
