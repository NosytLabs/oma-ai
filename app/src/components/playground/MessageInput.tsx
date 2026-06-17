'use client'

import { Send, MessageSquare, Coins, Loader2 } from 'lucide-react'
import { m } from 'framer-motion'
import { Magnetic, EASE_SPRING } from '@/lib/motion'
import { useLiveModels } from './ChatMessage'

interface MessageInputProps {
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  onStop: () => void
  loading: boolean
}

import { estimateTokens } from '@/lib/text'

export function MessageInput({ input, setInput, onSubmit, onStop, loading }: MessageInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div
      className="glass relative flex items-end px-2 py-2 transition-all duration-200 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20 focus-within:glow-accent-sm"
      role="search"
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="$ QUERY"
        aria-label="Enter your message"
        aria-describedby="message-hint"
        rows={1}
        className="flex-1 resize-none bg-transparent px-4 py-3 text-text-secondary placeholder-text-muted outline-none text-sm font-mono leading-relaxed focus:ring-0"
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
          <Magnetic strength={4}>
            <button
              onClick={onStop}
              aria-label="Stop generation"
              className="flex h-11 w-11 items-center justify-center bg-surface text-text-muted hover:bg-surface-elevated hover:text-text border border-border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              <m.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="inline-flex"
              >
                <Loader2 className="w-4 h-4" />
              </m.span>
            </button>
          </Magnetic>
        ) : (
          <Magnetic strength={6}>
            <m.button
              onClick={onSubmit}
              disabled={!input.trim()}
              aria-label="Send message"
              aria-describedby="message-hint"
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.04 }}
              transition={EASE_SPRING}
              className="flex h-11 w-11 items-center justify-center bg-accent text-text-inverse font-semibold transition-all hover:bg-accent-hover hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              <Send className="w-4 h-4" />
            </m.button>
          </Magnetic>
        )}
      </div>
      <span id="message-hint" className="sr-only">Shift+Enter for new line, Enter to send</span>
    </div>
  )
}

interface CostEstimateProps {
  inputText: string
  model: string
}

export function CostEstimate({ inputText, model }: CostEstimateProps) {
  const MODELS = useLiveModels()
  const selectedModel = MODELS.find(m => m.id === model)
  if (!selectedModel) return null

  const inputTokens = estimateTokens(inputText)
  const inputCost = (inputTokens / 1_000_000) * selectedModel.inputPer1M
  const estimatedOutputCost = (1500 / 1_000_000) * selectedModel.outputPer1M
  const totalCost = inputCost + estimatedOutputCost

  return (
    <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted uppercase tracking-wider">
      <div className="flex items-center gap-1.5">
        <MessageSquare className="w-3 h-3" />
        <span>{inputTokens} TK</span>
      </div>
      <div className="flex items-center gap-1.5 text-text-muted">
        <Coins className="w-3 h-3" />
        <span>${totalCost.toFixed(4)} EST</span>
      </div>
    </div>
  )
}