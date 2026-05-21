'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Settings,
  X,
  Key,
  Cpu,
  Clock,
  Hash,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Trash2,
  Zap,
  Terminal,
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
  { id: 'glm-5.1', name: 'GLM-5.1', category: 'Mid' },
  { id: 'kimi-k2-6', name: 'Kimi K2.6', category: 'Mid' },
  { id: 'mistral-large', name: 'Mistral Large', category: 'Frontier' },
  { id: 'mistral-small-3.2', name: 'Mistral Small 3.2', category: 'Mid' },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', category: 'Mid' },
  { id: 'gemma4-31b', name: 'Gemma 4 31B', category: 'Budget' },
  { id: 'venice-uncensored', name: 'Venice Uncensored', category: 'Uncensored' },
]

const API_URL = 'https://oma-ai.com/v1/chat/completions'

export default function PlaygroundPage() {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [totalTokens, setTotalTokens] = useState(0)
  const [lastLatency, setLastLatency] = useState<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('oma_api_key')
    if (stored) {
      setApiKey(stored)
      setApiKeyInput(stored)
      setConnectionStatus('connected')
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const saveApiKey = useCallback(() => {
    const key = apiKeyInput.trim()
    if (key) {
      setApiKey(key)
      localStorage.setItem('oma_api_key', key)
      setConnectionStatus('connected')
      setError(null)
    }
  }, [apiKeyInput])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return

    if (!apiKey) {
      setError('Enter your API key in the sidebar to start.')
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
              setTotalTokens(parsed.usage.total_tokens || 0)
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      setLastLatency(Date.now() - startTime)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // user cancelled
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
    }
  }, [input, apiKey, loading, messages, model, temperature, maxTokens, systemPrompt])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setTotalTokens(0)
    setLastLatency(null)
    setError(null)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'Frontier': return 'bg-pink/15 text-pink'
      case 'Reasoning': return 'bg-amber/15 text-amber'
      case 'Coding': return 'bg-cyan/15 text-cyan'
      case 'Premium': return 'bg-amber/15 text-amber'
      case 'Mid': return 'bg-cyan/15 text-cyan'
      case 'Budget': return 'bg-green/15 text-green'
      case 'Uncensored': return 'bg-pink/15 text-pink'
      default: return 'bg-surface text-text-dim'
    }
  }

  const statusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'status-dot--online'
      case 'error': return 'status-dot--offline'
      default: return 'status-dot--offline'
    }
  }

  if (!apiKey) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-panel p-8">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 text-cyan">
              <Key className="h-8 w-8" />
            </div>
          </div>
          <h2 className="mb-2 text-center text-xl font-bold">Enter API Key</h2>
          <p className="mb-6 text-center text-sm text-text-dim">
            Connect to the OMA API with your key. Get one from the dashboard.
          </p>
          <div className="mb-4">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
              placeholder="oma_sk_..."
              className="w-full font-mono text-sm"
            />
          </div>
          <button
            onClick={saveApiKey}
            disabled={!apiKeyInput.trim()}
            className="btn-primary w-full"
          >
            Connect
          </button>
          <p className="mt-4 text-center text-xs text-text-dim">
            Key is stored in localStorage. Never shared.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className={`shrink-0 border-r border-border bg-panel transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="flex h-full flex-col p-4">
          {/* Model Selector */}
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-dim">
              <Cpu className="h-3.5 w-3.5" />
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-xs"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${categoryColor(MODELS.find(m => m.id === model)?.category || '')}`}>
                {MODELS.find(m => m.id === model)?.category}
              </span>
              <span className="font-mono text-[10px] text-text-dim">{model}</span>
            </div>
          </div>

          {/* API Key */}
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-dim">
              <Key className="h-3.5 w-3.5" />
              API Key
            </label>
            <div className="flex items-center gap-1.5">
              <span className={`status-dot ${statusColor()}`} />
              <span className="font-mono text-[10px] text-text-dim truncate">
                {apiKey.slice(0, 10)}...{apiKey.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => {
                setApiKey('')
                setApiKeyInput('')
                localStorage.removeItem('oma_api_key')
                setConnectionStatus('disconnected')
              }}
              className="mt-1 text-[10px] text-pink hover:underline"
            >
              Remove key
            </button>
          </div>

          {/* Status */}
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-dim">
              <Zap className="h-3.5 w-3.5" />
              Status
            </label>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Connection</span>
                <div className="flex items-center gap-1.5">
                  <span className={`status-dot ${statusColor()}`} />
                  <span className={connectionStatus === 'connected' ? 'text-green' : connectionStatus === 'error' ? 'text-pink' : 'text-text-dim'}>
                    {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Error' : 'Offline'}
                  </span>
                </div>
              </div>
              {totalTokens > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-text-dim">Tokens</span>
                  <span className="font-mono text-cyan">{totalTokens.toLocaleString()}</span>
                </div>
              )}
              {lastLatency !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-dim">Latency</span>
                  <span className="font-mono text-amber">{(lastLatency / 1000).toFixed(1)}s</span>
                </div>
              )}
            </div>
          </div>

          {/* Settings Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-dim transition-colors hover:border-cyan/30 hover:text-cyan"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </span>
              {settingsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {settingsOpen && (
              <div className="mt-3 space-y-4 rounded-lg border border-border bg-void p-3">
                <div>
                  <label className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-dim">
                    <span>Temperature</span>
                    <span className="font-mono text-cyan">{temperature.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-cyan"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-dim">
                    <span>Max Tokens</span>
                    <span className="font-mono text-cyan">{maxTokens}</span>
                  </label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Math.max(1, Math.min(128000, parseInt(e.target.value) || 2048)))}
                    min={1}
                    max={128000}
                    className="w-full text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 flex text-[10px] font-bold uppercase tracking-wider text-text-dim">
                    System Prompt
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="You are a helpful assistant..."
                    rows={3}
                    className="w-full text-xs resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Clear Chat */}
          <div className="mt-auto">
            <button
              onClick={clearChat}
              disabled={messages.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-dim transition-colors hover:border-pink/30 hover:text-pink disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Chat
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-border bg-panel/50 px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded p-1 text-text-dim transition-colors hover:text-cyan"
            >
              <Settings className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs text-text-dim">
              {model}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${categoryColor(MODELS.find(m => m.id === model)?.category || '')}`}>
              {MODELS.find(m => m.id === model)?.category}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-text-dim">
            {totalTokens > 0 && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {totalTokens.toLocaleString()} tokens
              </span>
            )}
            {lastLatency !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(lastLatency / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 text-cyan">
                    <Terminal className="h-8 w-8" />
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-bold">OMA Playground</h3>
                <p className="text-sm text-text-dim">Send a message to start chatting with {model}.</p>
                <p className="mt-2 text-xs text-text-dim">Streaming enabled. Shift+Enter for new lines.</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg border px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'border-cyan/30 bg-cyan/10 text-cyan'
                    : 'border-border bg-panel text-text'
                }`}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {msg.content || (loading && streaming && msg.role === 'assistant' ? '' : '')}
                  {loading && streaming && msg.role === 'assistant' && !msg.content && (
                    <span className="inline-block h-4 w-2 animate-pulse bg-cyan" />
                  )}
                  {loading && streaming && msg.role === 'assistant' && msg.content && (
                    <span className="inline-block h-4 w-0.5 animate-pulse bg-cyan ml-0.5" />
                  )}
                </div>
                {msg.role === 'assistant' && msg.content && (msg.tokens || msg.latency) && (
                  <div className="mt-2 flex items-center gap-3 border-t border-border/50 pt-2 text-[10px] text-text-dim">
                    {msg.tokens && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-2.5 w-2.5" />
                        {msg.tokens} chunks
                      </span>
                    )}
                    {msg.latency && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {(msg.latency / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="border-t border-pink/30 bg-pink/5 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-pink">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-text-dim hover:text-text">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-panel/50 p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${model}...`}
              rows={1}
              className="flex-1 resize-none text-sm"
              disabled={loading}
              style={{ minHeight: '40px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
            {loading ? (
              <button
                onClick={stopGeneration}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-pink bg-pink/10 text-pink transition-colors hover:bg-pink/20"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan bg-cyan/10 text-cyan transition-colors hover:bg-cyan/20 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-text-dim">
            <span>Shift+Enter for new line. Streaming enabled.</span>
            <span>Base URL: oma-ai.com/v1</span>
          </div>
        </div>
      </div>
    </div>
  )
}
