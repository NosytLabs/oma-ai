'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

export const MODELS: ModelOption[] = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', category: 'frontier', provider: 'Venice', inputPer1M: 15.00, outputPer1M: 75.00, ctx: '200K' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', category: 'frontier', provider: 'Venice', inputPer1M: 3.00, outputPer1M: 15.00, ctx: '200K' },
  { id: 'gpt-5.5', name: 'GPT-5.5', category: 'frontier', provider: 'Venice', inputPer1M: 10.00, outputPer1M: 30.00, ctx: '128K' },
  { id: 'gpt-4o', name: 'GPT-4o', category: 'frontier', provider: 'Venice', inputPer1M: 2.50, outputPer1M: 10.00, ctx: '128K' },
  { id: 'o3', name: 'OpenAI o3', category: 'frontier', provider: 'Venice', inputPer1M: 10.00, outputPer1M: 40.00, ctx: '200K' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', category: 'frontier', provider: 'Venice', inputPer1M: 1.50, outputPer1M: 9.00, ctx: '1M' },
  { id: 'mistral-large', name: 'Mistral Large', category: 'frontier', provider: 'Venice', inputPer1M: 2.00, outputPer1M: 6.00, ctx: '128K' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', category: 'premium', provider: 'Venice', inputPer1M: 0.80, outputPer1M: 4.00, ctx: '200K' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'premium', provider: 'Venice', inputPer1M: 0.15, outputPer1M: 0.60, ctx: '128K' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'premium', provider: 'Venice', inputPer1M: 0.15, outputPer1M: 0.60, ctx: '1M' },
  { id: 'grok-41-fast', name: 'Grok 4.1 Fast', category: 'premium', provider: 'AntSeed', inputPer1M: 0.26, outputPer1M: 0.66, ctx: '128K' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', category: 'premium', provider: 'AntSeed', inputPer1M: 0.18, outputPer1M: 1.00, ctx: '128K' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', category: 'reasoning', provider: 'AntSeed', inputPer1M: 0.55, outputPer1M: 2.19, ctx: '64K' },
  { id: 'qwen3-coder-480b', name: 'Qwen3 Coder 480B', category: 'coding', provider: 'AntSeed', inputPer1M: 0.14, outputPer1M: 0.60, ctx: '128K' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', category: 'mid', provider: 'AntSeed', inputPer1M: 0.05, outputPer1M: 0.19, ctx: '128K' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', category: 'mid', provider: 'Both', inputPer1M: 0.30, outputPer1M: 0.48, ctx: '128K' },
  { id: 'qwen3-235b', name: 'Qwen3 235B', category: 'mid', provider: 'AntSeed', inputPer1M: 0.09, outputPer1M: 0.45, ctx: '128K' },
  { id: 'glm-5.1', name: 'GLM-5.1', category: 'mid', provider: 'AntSeed', inputPer1M: 0.25, outputPer1M: 0.60, ctx: '128K' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.01, ctx: '128K' },
  { id: 'qwen3-8b', name: 'Qwen3 8B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.01, ctx: '32K' },
  { id: 'venice-uncensored', name: 'Venice Uncensored', category: 'uncensored', provider: 'Venice', inputPer1M: 0.07, outputPer1M: 0.35, ctx: '32K' },
]

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
      <pre className="bg-zinc-900 text-zinc-100 rounded-xl p-4 overflow-x-auto text-sm leading-relaxed border border-zinc-800">
        <code className={className}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-zinc-700"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

interface SearchSourcesProps {
  results: SearchResult[]
  expanded: boolean
  onToggle: () => void
}

function SearchSources({ results, expanded, onToggle }: SearchSourcesProps) {
  const getFaviconUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
    } catch {
      return null
    }
  }

  if (results.length === 0) return null

  return (
    <div className="my-4 border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-surface transition-colors"
      >
        <span className="flex items-center gap-2 text-sm text-zinc-400">
          <Search className="w-4 h-4" />
          {results.length} source{results.length !== 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2 bg-surface">
              {results.map((result, i) => (
                <a
                  key={i}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 bg-surface-elevated border border-border rounded-lg hover:border-accent/50 transition-colors group"
                >
                  <img
                    src={getFaviconUrl(result.url) || ''}
                    alt=""
                    className="w-5 h-5 mt-0.5 rounded-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-accent group-hover:underline truncate">{result.title}</div>
                    <div className="text-xs text-zinc-500 truncate">{new URL(result.url).hostname}</div>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
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

export function ChatMessage({ msg, loading, onCopy }: ChatMessageProps) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [sourcesExpanded, setSourcesExpanded] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy(msg.content)
  }, [msg.content, onCopy])

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
        isUser ? 'bg-accent' : 'bg-surface-elevated border border-border'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-void" />
        ) : (
          <Bot className="w-5 h-5 text-accent" />
        )}
      </div>

      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {msg.searchResults && msg.searchResults.length > 0 && (
          <SearchSources
            results={msg.searchResults}
            expanded={sourcesExpanded}
            onToggle={() => setSourcesExpanded(!sourcesExpanded)}
          />
        )}
        <div className={`px-5 py-4 leading-relaxed ${
          isUser
            ? 'bg-accent/10 border border-accent/20 text-text rounded-2xl rounded-tr-sm'
            : 'bg-surface-elevated border border-border text-text rounded-2xl rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <div className="markdown-content prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match && !className
                    return isInline ? (
                      <code className="px-1.5 py-0.5 bg-zinc-800 text-accent rounded font-mono text-sm" {...props}>
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
                <span className="inline-flex gap-1 mt-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-3 mt-2 text-xs text-zinc-600 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span>{time}</span>
          {msg.tokens && (
            <span className="font-mono">{msg.tokens} tokens</span>
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
              className="flex items-center gap-1 hover:text-accent transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}