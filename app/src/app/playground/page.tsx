'use client'

import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { ChatPlaygroundShell } from '../chat/_components/ChatPlaygroundShell'

function PlaygroundLoadingFallback() {
  return (
    <div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">
      <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse" />
      <div className="flex gap-4">
        <div className="w-10 h-10 shrink-0 rounded bg-surface-elevated animate-pulse" />
        <div className="flex flex-col max-w-[80%] gap-2 flex-1">
          <div className="h-20 w-full bg-surface-elevated rounded animate-pulse" />
          <div className="h-4 w-20 bg-surface-elevated rounded animate-pulse" />
        </div>
      </div>
      <div className="h-16 w-full bg-surface-elevated rounded animate-pulse" />
    </div>
  )
}

export default function PlaygroundPage() {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
          <p className="text-text-muted font-mono text-sm">Playground encountered an error</p>
        </div>
      }
    >
      <Suspense fallback={<PlaygroundLoadingFallback />}>
        <ChatPlaygroundShell
          variant="playground"
          storageKey="oma_playground_conversation"
          systemPromptKey="oma_playground_system_prompt"
          conversationIdKey="oma_playground_conversation_id"
        />
      </Suspense>
    </ErrorBoundary>
  )
}
