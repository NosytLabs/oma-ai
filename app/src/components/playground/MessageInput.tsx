'use client'

import { Send, X, MessageSquare, Coins } from 'lucide-react'
import { MODELS } from './ChatMessage'

interface MessageInputProps {
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  onStop: () => void
  loading: boolean
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function formatCost(cents: number): string {
  if (cents < 1) return '<$0.01'
  return `$${(cents / 100).toFixed(2)}`
}

export function MessageInput({ input, setInput, onSubmit, onStop, loading }: MessageInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="relative flex items-end bg-surface border border-border rounded-xl px-2 py-2 transition-all focus-within:border-accent/50">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything..."
        aria-label="Message input"
        rows={1}
        className="flex-1 resize-none bg-transparent px-4 py-3 text-text placeholder-zinc-600 outline-none text-[15px] leading-relaxed"
        disabled={loading}
        style={{ minHeight: '52px', maxHeight: '200px' }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement
          target.style.height = 'auto'
          target.style.height = Math.min(target.scrollHeight, 200) + 'px'
        }}
      />
      <div className="p-1">
        {loading ? (
          <button
            onClick={onStop}
            aria-label="Stop generation"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!input.trim()}
            aria-label="Send message"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-void transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none animate-pulse-glow"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

interface CostEstimateProps {
  inputText: string
  model: string
}

export function CostEstimate({ inputText, model }: CostEstimateProps) {
  const selectedModel = MODELS.find(m => m.id === model)
  if (!selectedModel) return null

  const inputTokens = estimateTokens(inputText)
  const inputCost = (inputTokens / 1_000_000) * selectedModel.inputPer1M
  const estimatedOutputCost = (1500 / 1_000_000) * selectedModel.outputPer1M
  const totalCost = inputCost + estimatedOutputCost

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <MessageSquare className="w-3 h-3" />
        <span className="font-mono">{inputTokens}</span>
        <span>tokens</span>
      </div>
      <div className="flex items-center gap-1.5 text-secondary">
        <Coins className="w-3 h-3" />
        <span className="font-mono">{formatCost(totalCost * 100)}</span>
        <span>est.</span>
      </div>
    </div>
  )
}