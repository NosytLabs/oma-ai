'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '@/lib/api'
import { MODELS as SOURCE_MODELS } from '@/lib/models-data'
import {
  Search,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  Clock,
  User,
  Bot,
} from 'lucide-react'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  favicon?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  tokens?: number
  latency?: number
  inputTokens?: number
  outputTokens?: number
  searchResults?: SearchResult[]
}

export interface ModelOption {
  id: string
  name: string
  category: 'frontier' | 'premium' | 'mid' | 'budget' | 'reasoning' | 'coding' | 'uncensored'
  provider: 'Venice' | 'AntSeed' | 'Both'
  inputPer1M: number
  outputPer1M: number
  ctx: string
}

export type TierFilter = 'all' | 'frontier' | 'premium' | 'mid' | 'budget' | 'reasoning' | 'coding' | 'uncensored'

export const FALLBACK_MODELS: ModelOption[] = SOURCE_MODELS.map((m) => {
  const validCats: ModelOption['category'][] = ['frontier', 'premium', 'mid', 'budget', 'reasoning', 'coding', 'uncensored']
  const cat = validCats.includes(m.tier as ModelOption['category']) ? (m.tier as ModelOption['category']) : 'mid'
  const provider: ModelOption['provider'] = m.provider === 'AntSeed' ? 'AntSeed' : 'Venice'
  return {
    id: m.id,
    name: m.name,
    category: cat,
    provider,
    inputPer1M: m.inputPricePer1M,
    outputPer1M: m.outputPricePer1M,
    ctx: m.contextLength,
  }
})

const LIVE_MODELS_TTL_MS = 5 * 60 * 1000
let liveModelsCache: { data: ModelOption[]; ts: number } | null = null

interface LiveModelRaw {
  id: string
  category?: string
  context_length?: number
  provider?: string
  pricing?: { prompt?: string; completion?: string }
}

function formatCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return `${n}`
}

function mapLiveModel(m: LiveModelRaw): ModelOption {
  const validCats: ModelOption['category'][] = ['frontier', 'premium', 'mid', 'budget', 'reasoning', 'coding', 'uncensored']
  const cat = validCats.includes(m.category as ModelOption['category']) ? (m.category as ModelOption['category']) : 'mid'
  const provider: ModelOption['provider'] = m.provider === 'AntSeed' ? 'AntSeed' : 'Venice'
  return {
    id: m.id,
    name: m.id,
    category: cat,
    provider,
    inputPer1M: m.pricing?.prompt ? parseFloat(m.pricing.prompt) * 1_000_000 : 0,
    outputPer1M: m.pricing?.completion ? parseFloat(m.pricing.completion) * 1_000_000 : 0,
    ctx: m.context_length ? formatCtx(m.context_length) : '128K',
  }
}

export function useLiveModels(): ModelOption[] {
  const [models, setModels] = useState<ModelOption[]>(() =>
    liveModelsCache && Date.now() - liveModelsCache.ts < LIVE_MODELS_TTL_MS
      ? liveModelsCache.data
      : FALLBACK_MODELS,
  )

  useEffect(() => {
    if (liveModelsCache && Date.now() - liveModelsCache.ts < LIVE_MODELS_TTL_MS) return
    let cancelled = false
    api.models()
      .then((data) => {
        if (cancelled || !data?.data?.length) return
        const mapped = (data.data as unknown as LiveModelRaw[])
          .filter((m) => m.category !== 'video')
          .map(mapLiveModel)
        if (mapped.length === 0) return
        liveModelsCache = { data: mapped, ts: Date.now() }
        setModels(mapped)
      })
      .catch(() => { /* keep fallback on error */ })
    return () => { cancelled = true }
  }, [])

  return models
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface CodeBlockProps {
  children: string
  className?: string
}

function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="relative group my-4">
      <pre className="bg-void text-text p-4 overflow-x-auto text-xs leading-relaxed border border-border font-mono">
        <code className={className}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        className="absolute top-2 right-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center bg-surface-elevated text-text-muted hover:text-text opacity-0 group-hover:opacity-100 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

interface SearchSourcesProps {
  results: SearchResult[]
  expanded: boolean
  onToggle: () => void
  prefersReducedMotion?: boolean | null
}

function SearchSources({ results, expanded, onToggle, prefersReducedMotion }: SearchSourcesProps) {
  const motionPrefersReducedMotion = prefersReducedMotion ?? false
  const getFaviconUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
    } catch {
      return null
    }
  }

  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  if (results.length === 0) return null

  return (
    <div className="my-4 border border-border overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} search sources, ${results.length} result${results.length !== 1 ? 's' : ''}`}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        <span className="flex items-center gap-2 text-xs font-mono text-text-muted uppercase tracking-wider">
          <Search className="w-3.5 h-3.5" />
          {results.length} SOURCE{results.length !== 1 ? 'S' : ''}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <m.div
            initial={motionPrefersReducedMotion ? { height: 'auto' } : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={motionPrefersReducedMotion ? { height: 'auto' } : { height: 0 }}
            transition={motionPrefersReducedMotion ? { duration: 0 } : undefined}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2 bg-void">
              {results.map((result, i) => (
                <a
                  key={i}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 bg-surface border border-border hover:border-success/30 transition-colors group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getFaviconUrl(result.url) || ''}
                    alt=""
                    aria-hidden="true"
                    className="w-4 h-4 mt-0.5 rounded-sm"
                    onError={(e) => { (e.target as HTMLImageElement).classList.add('img-error') }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-success group-hover:underline truncate">{result.title}</div>
                    <div className="text-[10px] text-text-muted font-mono truncate">{getHostname(result.url)}</div>
                  </div>
                </a>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ChatMessageProps {
  msg: Message
  loading: boolean
  onCopy: (content: string) => void
}

export const ChatMessage = memo(function ChatMessage({ msg, loading, onCopy }: ChatMessageProps) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const prefersReducedMotion = useReducedMotion() ?? false

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy(msg.content)
  }, [msg.content, onCopy])

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <m.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`shrink-0 w-10 h-10 flex items-center justify-center ${
        isUser ? 'bg-success/10 border border-success/20' : 'bg-surface border border-border'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-success" />
        ) : (
          <Bot className="w-5 h-5 text-text-muted" />
        )}
      </div>

      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {msg.searchResults && msg.searchResults.length > 0 && (
          <SearchSources
            results={msg.searchResults}
            expanded={sourcesExpanded}
            onToggle={() => setSourcesExpanded(!sourcesExpanded)}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
        <div className={`px-5 py-4 leading-relaxed font-mono text-sm ${
          isUser
            ? 'bg-success/10 border border-success/30 text-text border-r-0'
            : 'bg-surface/50 border border-border text-text-secondary border-l-0'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <div className="markdown-content font-mono text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match && !className
                    return isInline ? (
                      <code className="px-1.5 py-0.5 bg-surface-elevated text-success font-mono text-xs" {...props}>
                        {children}
                      </code>
                    ) : (
                      <CodeBlock className={className}>
                        {String(children).replace(/\n$/, '')}
                      </CodeBlock>
                    )
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
              {loading && msg.role === 'assistant' && (
                <span className="inline-flex gap-1 mt-3">
                  <span className={`w-1.5 h-1.5 bg-success rounded-full ${prefersReducedMotion ? '' : 'animate-bounce'}`} style={{ animationDelay: '0ms' }} />
                  <span className={`w-1.5 h-1.5 bg-success rounded-full ${prefersReducedMotion ? '' : 'animate-bounce'}`} style={{ animationDelay: '150ms' }} />
                  <span className={`w-1.5 h-1.5 bg-success rounded-full ${prefersReducedMotion ? '' : 'animate-bounce'}`} style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-3 mt-2 text-[10px] text-text-muted font-mono ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span>{time}</span>
          {msg.tokens && (
            <span>TK:{msg.tokens}</span>
          )}
          {msg.latency && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(msg.latency)}
            </span>
          )}
          {!isUser && msg.content && !loading && (
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Copied to clipboard' : 'Copy message to clipboard'}
              className="flex items-center gap-1 min-h-11 px-4 py-3 hover:text-success transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          )}
        </div>
      </div>
    </m.div>
  )
}, (prevProps, nextProps) => {
  const prev = prevProps.msg
  const next = nextProps.msg
  return prev.role === next.role &&
    prev.content === next.content &&
    prev.timestamp === next.timestamp &&
    prev.tokens === next.tokens &&
    prev.latency === next.latency &&
    prevProps.loading === nextProps.loading
})
