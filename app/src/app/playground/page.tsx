'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send,
  X,
  ChevronDown,
  Trash2,
  Sparkles,
  User,
  Bot,
  Copy,
  Check,
  Plus,
  Settings2,
  Zap
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  tokens?: number
  latency?: number
}

interface ModelOption {
  id: string
  name: string
  category: string
}

const MODELS: ModelOption[] = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', category: 'Frontier' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', category: 'Frontier' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', category: 'Premium' },
  { id: 'gpt-5.5', name: 'GPT-5.5', category: 'Frontier' },
  { id: 'gpt-4o', name: 'GPT-4o', category: 'Frontier' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'Premium' },
  { id: 'o3', name: 'OpenAI o3', category: 'Frontier' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', category: 'Frontier' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'Premium' },
  { id: 'grok-41-fast', name: 'Grok 4.1 Fast', category: 'Premium' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', category: 'Premium' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', category: 'Mid' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', category: 'Reasoning' },
  { id: 'qwen3-coder-480b', name: 'Qwen3 Coder 480B', category: 'Coding' },
  { id: 'qwen3-235b', name: 'Qwen3 235B', category: 'Mid' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', category: 'Mid' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', category: 'Budget' },
  { id: 'venice-uncensored', name: 'Venice Uncensored', category: 'Uncensored' },
]

const API_URL = '/api/v1/chat/completions'

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="relative group my-4">
      <pre className="bg-zinc-900 text-zinc-100 rounded-2xl p-4 overflow-x-auto text-sm leading-relaxed shadow-lg">
        <code className={className}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-zinc-700"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

function ModelSelector({ model, setModel, sidebarOpen, setSidebarOpen }: {
  model: string
  setModel: (m: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (o: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedModel = MODELS.find(m => m.id === model)

  return (
    <div className="flex items-center gap-3">
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 px-4 py-2.5 bg-white/80 backdrop-blur-xl border border-zinc-200/50 rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:border-zinc-300/80 group"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-zinc-900">{selectedModel?.name || 'Select Model'}</span>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-xl border border-zinc-200/50 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 max-h-80 overflow-y-auto">
              {['Frontier', 'Premium', 'Mid', 'Reasoning', 'Coding', 'Budget', 'Uncensored'].map(category => (
                <div key={category}>
                  <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {category}
                  </div>
                  {MODELS.filter(m => m.category === category).map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setOpen(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 ${
                        m.id === model
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <span className="font-medium">{m.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2.5 bg-white/80 backdrop-blur-xl border border-zinc-200/50 rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300/80"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Settings2 className="w-5 h-5" />}
      </button>
    </div>
  )
}

function Sidebar({ sidebarOpen, setSidebarOpen, apiKey, setApiKey, temperature, setTemperature, maxTokens, setMaxTokens, systemPrompt, setSystemPrompt, clearChat, messages, connectionStatus }: {
  sidebarOpen: boolean
  setSidebarOpen: (o: boolean) => void
  apiKey: string
  setApiKey: (k: string) => void
  temperature: number
  setTemperature: (t: number) => void
  maxTokens: number
  setMaxTokens: (t: number) => void
  systemPrompt: string
  setSystemPrompt: (s: string) => void
  clearChat: () => void
  messages: Message[]
  connectionStatus: string
}) {
  const [apiKeyInput, setApiKeyInput] = useState(apiKey)

  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim()
    if (key) {
      setApiKey(key)
      localStorage.setItem('oma_api_key', key)
    }
  }

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/20 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white/95 backdrop-blur-xl border-r border-zinc-200/50 shadow-xl transform transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-zinc-900">Settings</h3>
                <p className="text-xs text-zinc-500">Configure your experience</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto">
            <div className="p-4 bg-zinc-50/80 rounded-2xl border border-zinc-200/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-zinc-700">API Connection</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${
                  connectionStatus === 'connected' ? 'text-emerald-600' : 'text-zinc-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'
                  }`} />
                  {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="mb-3 text-xs text-zinc-500">
                Privacy-first inference via Venice AI
              </div>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                placeholder="oma_sk_..."
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
              {apiKey !== apiKeyInput && (
                <button
                  onClick={handleSaveApiKey}
                  className="mt-2 w-full py-2 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors shadow-md"
                >
                  Save Key
                </button>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Parameters</h4>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-zinc-700">Temperature</label>
                  <span className="text-sm font-mono text-indigo-600">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-zinc-700">Max Tokens</label>
                  <span className="text-sm font-mono text-indigo-600">{maxTokens}</span>
                </div>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Math.max(1, Math.min(128000, parseInt(e.target.value) || 2048)))}
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                rows={4}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200/50">
            <button
              onClick={clearChat}
              disabled={messages.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm font-medium text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Clear Conversation
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ChatMessage({ msg, loading, streaming }: {
  msg: Message
  loading: boolean
  streaming: boolean
}) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-message-in`}>
      <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
        isUser
          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600'
          : 'bg-white border border-zinc-200/50'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-zinc-600" />
        )}
      </div>

      <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-5 py-4 leading-relaxed transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
          isUser
            ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-lg'
            : 'bg-white border border-zinc-200/50 text-zinc-900 rounded-2xl rounded-tl-sm shadow-md'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match && !className
                    return isInline ? (
                      <code className="px-1.5 py-0.5 bg-zinc-100 text-indigo-600 rounded-lg font-mono text-sm" {...props}>
                        {children}
                      </code>
                    ) : (
                      <CodeBlock className={className}>
                        {String(children).replace(/\n$/, '')}
                      </CodeBlock>
                    )
                  },
                  pre({ children }: React.ComponentProps<'pre'>) {
                    return <>{children}</>
                  },
                  p({ children }: React.ComponentProps<'p'>) {
                    return <p className="mb-4 last:mb-0">{children}</p>
                  },
                  ul({ children }: React.ComponentProps<'ul'>) {
                    return <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
                  },
                  ol({ children }: React.ComponentProps<'ol'>) {
                    return <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>
                  },
                  li({ children }: React.ComponentProps<'li'>) {
                    return <li className="text-zinc-700">{children}</li>
                  },
                  h1({ children }: React.ComponentProps<'h1'>) {
                    return <h1 className="text-xl font-bold mb-3 text-zinc-900">{children}</h1>
                  },
                  h2({ children }: React.ComponentProps<'h2'>) {
                    return <h2 className="text-lg font-bold mb-2 text-zinc-900">{children}</h2>
                  },
                  h3({ children }: React.ComponentProps<'h3'>) {
                    return <h3 className="text-base font-bold mb-2 text-zinc-900">{children}</h3>
                  },
                  blockquote({ children }: React.ComponentProps<'blockquote'>) {
                    return <blockquote className="border-l-4 border-indigo-300 pl-4 italic text-zinc-600 my-4">{children}</blockquote>
                  },
                  a({ href, children }: React.ComponentProps<'a'>) {
                    return <a href={href} className="text-indigo-600 hover:text-indigo-700 underline" target="_blank" rel="noopener noreferrer">{children}</a>
                  },
                  strong({ children }: React.ComponentProps<'strong'>) {
                    return <strong className="font-semibold text-zinc-900">{children}</strong>
                  },
                  em({ children }: React.ComponentProps<'em'>) {
                    return <em className="italic">{children}</em>
                  },
                  table({ children }: React.ComponentProps<'table'>) {
                    return <table className="w-full border-collapse my-4">{children}</table>
                  },
                  th({ children }: React.ComponentProps<'th'>) {
                    return <th className="border border-zinc-200 px-4 py-2 bg-zinc-50 font-semibold text-left">{children}</th>
                  },
                  td({ children }: React.ComponentProps<'td'>) {
                    return <td className="border border-zinc-200 px-4 py-2">{children}</td>
                  },
                  hr() {
                    return <hr className="border-zinc-200 my-6" />
                  }
                }}
              >
                {msg.content || (loading && streaming && msg.role === 'assistant' ? '' : '')}
              </ReactMarkdown>
              {loading && streaming && msg.role === 'assistant' && !msg.content && (
                <span className="inline-block h-5 w-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              )}
              {loading && streaming && msg.role === 'assistant' && msg.content && (
                <span className="inline-block ml-1">
                  <span className="inline-block h-2 w-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block h-2 w-2 bg-indigo-400 rounded-full animate-bounce ml-1" style={{ animationDelay: '150ms' }} />
                  <span className="inline-block h-2 w-2 bg-indigo-400 rounded-full animate-bounce ml-1" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16 animate-fade-in">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-8 shadow-xl animate-float">
        <Sparkles className="w-12 h-12 text-white" />
      </div>
      <h1 className="text-4xl font-syne font-bold text-zinc-900 mb-4 animate-slide-up">
        What would you like to create?
      </h1>
      <p className="text-zinc-500 text-lg max-w-md animate-slide-up" style={{ animationDelay: '100ms' }}>
        Ask any question, brainstorm ideas, or explore new concepts together. Powered by Venice AI.
      </p>
    </div>
  )
}

export default function PlaygroundPage() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-v4-pro')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('oma_api_key')
    if (stored) {
      setApiKey(stored)
      setConnectionStatus('connected')
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return

    if (!apiKey) {
      setError('Enter your API key in the sidebar to start.')
      setSidebarOpen(true)
      return
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const apiMessages = []
    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt })
    }
    const allMessages = [...messages, userMessage]
    for (const m of allMessages) {
      apiMessages.push({ role: m.role, content: m.content })
    }

    setMessages(allMessages)
    setInput('')
    setLoading(true)
    setError(null)
    setStreaming(true)
    setConnectionStatus('connected')

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages([...allMessages, assistantMessage])

    const startTime = Date.now()
    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => null)
        const errMsg = errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(errMsg)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let accumulated = ''
      let tokenCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              accumulated += delta
              tokenCount += 1
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: accumulated,
                  tokens: tokenCount,
                  latency: Date.now() - startTime,
                }
                return updated
              })
            }

            if (parsed.usage) {
            }
          } catch {
          }
        }
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error occurred'
        setError(message)
        if (message.includes('401') || message.includes('authentication')) {
          setConnectionStatus('error')
        }
        setMessages(prev => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.content === '') {
            updated.pop()
          }
          return updated
        })
      }
    } finally {
      setLoading(false)
      setStreaming(false)
      abortRef.current = null
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, apiKey, loading, messages, model, temperature, maxTokens, systemPrompt])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const allowAnonymousChat = true

  if (!apiKey && !allowAnonymousChat) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-zinc-200/50 shadow-xl p-10 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-syne font-bold text-text mb-3">Welcome to the Playground</h2>
            <p className="text-text-secondary mb-8">
              Connect your wallet or enter your API key to start chatting with AI models.
            </p>
            <Link
              href="/dashboard"
              className="w-full py-4 bg-gradient-to-r from-accent to-accent-hover text-white rounded-2xl font-semibold text-lg hover:shadow-lg transition-all shadow-lg mb-4 inline-block text-center"
            >
              Connect Wallet
            </Link>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-zinc-400">Or continue with API key</span>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="password"
                value={apiKey || ''}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && apiKey && localStorage.setItem('oma_api_key', apiKey)}
                placeholder="oma_sk_..."
                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-center font-mono text-lg mb-4 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                autoFocus
              />
              <button
                onClick={() => {
                  if (apiKey) {
                    localStorage.setItem('oma_api_key', apiKey)
                    setConnectionStatus('connected')
                  }
                }}
                disabled={!apiKey.trim()}
                className="w-full py-4 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-semibold text-lg hover:bg-zinc-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Use API Key
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      <style jsx>{`
        @keyframes messageIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes bounce-send {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-message-in {
          animation: messageIn 300ms ease-out forwards;
        }
        .animate-fade-in {
          animation: fadeIn 500ms ease-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 500ms ease-out forwards;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-bounce-send {
          animation: bounce-send 300ms ease-in-out;
        }
        .animate-pulse-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }
      `}</style>

      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        apiKey={apiKey}
        setApiKey={setApiKey}
        temperature={temperature}
        setTemperature={setTemperature}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        clearChat={clearChat}
        messages={messages}
        connectionStatus={connectionStatus}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-zinc-50/80 backdrop-blur-xl border-b border-zinc-200/50">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <ModelSelector
              model={model}
              setModel={setModel}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
            />

            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-8">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    msg={msg}
                    loading={loading}
                    streaming={streaming}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        <footer className="sticky bottom-0 bg-zinc-50/80 backdrop-blur-xl border-t border-zinc-200/50">
          <div className="max-w-3xl mx-auto px-6 py-4">
            {error && (
              <div className="mb-4 flex items-center justify-between px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-600">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="relative flex items-end bg-white rounded-2xl border border-zinc-200/50 shadow-lg px-2 py-2 transition-all focus-within:border-indigo-300 focus-within:shadow-xl">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className="flex-1 resize-none bg-transparent px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none text-[15px] leading-relaxed"
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
                    onClick={stopGeneration}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 hover:bg-rose-100 hover:text-rose-600 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white transition-all hover:from-indigo-600 hover:to-indigo-700 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none animate-bounce-send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-zinc-400">
              Press Enter to send. AI models can make mistakes.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}