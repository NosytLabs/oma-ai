'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import {
  X,
  Trash2,
  Settings2,
  ChevronLeft,
  Search,
  Share2,
  Download,
} from 'lucide-react'
import {
  Message,
  SearchResult,
  ChatMessage,
} from '@/components/playground/ChatMessage'
import { ModelSelector } from '@/components/playground/ModelSelector'
import { MessageInput, CostEstimate } from '@/components/playground/MessageInput'
import { SettingsPanel } from '@/components/playground/SettingsPanel'
import { EmptyState } from '@/components/playground/PresetPrompts'

const STORAGE_KEY = 'oma_playground_conversation'
const API_URL = '/api/v1/chat/completions'

interface StatsBarProps {
  messages: Message[]
}

function StatsBar({ messages }: StatsBarProps) {
  const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0)
  const totalCost = messages.reduce((acc, m) => {
    if (m.inputTokens && m.outputTokens) {
      return acc + (m.inputTokens + m.outputTokens) * 0.001
    }
    return acc
  }, 0)

  if (messages.length === 0) return null

  return (
    <div className="flex items-center gap-6 text-xs text-zinc-500">
      <span>{messages.filter(m => m.role === 'user').length} messages</span>
      {totalTokens > 0 && (
        <>
          <span>{totalTokens} tokens</span>
          <span className="text-secondary">${totalCost.toFixed(4)} est.</span>
        </>
      )}
    </div>
  )
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export default function PlaygroundPage() {
  const [model, setModel] = useState('deepseek-v4-pro')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paramsOpen, setParamsOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(1)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [topK, setTopK] = useState(40)
  const [freqPenalty, setFreqPenalty] = useState(0)
  const [presPenalty, setPresPenalty] = useState(0)
  const [stream, setStream] = useState(true)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [searching, setSearching] = useState(false)
  const [, setSearchResults] = useState<SearchResult[]>([])
  const toast = useToast()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      inputTokens: estimateTokens(input.trim()),
    }

    const allMessages = [...messages, userMessage]
    setMessages(allMessages)
    setInput('')
    setLoading(true)
    setError(null)
    setSearchResults([])

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages([...allMessages, assistantMessage])

    const startTime = Date.now()
    const abortController = new AbortController()
    abortRef.current = abortController

    let messagesWithSearch = allMessages
    let currentSearchResults: SearchResult[] = []
    
    if (webSearchEnabled && input.trim()) {
      setSearching(true)
      try {
        const searchResp = await fetch(`/api/v1/search?query=${encodeURIComponent(input.trim())}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('oma_api_key') || ''}` }
        })
        if (searchResp.ok) {
          const searchData = await searchResp.json()
          if (searchData.results?.length > 0) {
            currentSearchResults = searchData.results.map((r: { title: string; url: string; snippet: string; favicon?: string }) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              favicon: r.favicon,
            }))
            setSearchResults(currentSearchResults)
            const searchContext: Message = {
              role: 'system',
              content: `Web search results for "${input.trim()}":\n\n${searchData.results.map((r: { title: string; url: string; snippet: string }) => 
                `- ${r.title}\n  ${r.snippet}\n  Source: ${r.url}`
              ).join('\n\n')}`,
              timestamp: Date.now(),
            }
            messagesWithSearch = [searchContext, ...allMessages]
          }
        }
      } catch {
        // Search failed, continue without
      } finally {
        setSearching(false)
      }
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('oma_api_key') || ''}`,
        },
        body: JSON.stringify({
          model,
          messages: messagesWithSearch.map(m => ({ role: m.role, content: m.content })),
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
          top_k: topK,
          frequency_penalty: freqPenalty,
          presence_penalty: presPenalty,
          stream,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => null)
        const errMsg = errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(errMsg)
      }

      if (stream && response.body) {
        const reader = response.body.getReader()
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
                  const lastIdx = updated.length - 1
                  if (lastIdx >= 0) {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: accumulated,
                      tokens: tokenCount,
                      latency: Date.now() - startTime,
                      searchResults: lastIdx === updated.length - 1 ? currentSearchResults : updated[lastIdx].searchResults,
                    }
                  }
                  return updated
                })
              }
            } catch {}
          }
        }
      } else {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content,
              tokens: data.usage?.total_tokens || 0,
              latency: Date.now() - startTime,
              searchResults: currentSearchResults,
            }
          }
          return updated
        })
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.content === '') {
            return updated.slice(0, -1)
          }
          return updated
        })
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        setMessages(prev => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.content === '') {
            return updated.slice(0, -1)
          }
          return updated
        })
      }
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, loading, messages, model, temperature, topP, maxTokens, topK, freqPenalty, presPenalty, stream, webSearchEnabled])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
    localStorage.removeItem(STORAGE_KEY)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handlePreset = useCallback((prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }, [])

  const handleCopy = useCallback(() => {
    toast.success('Copied to clipboard')
  }, [toast])

  const exportConversation = useCallback(() => {
    const data = JSON.stringify(messages, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversation-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [messages])

  const shareConversation = useCallback(() => {
    const id = Math.random().toString(36).slice(2, 10)
    const data = { id, messages }
    localStorage.setItem(`oma_share_${id}`, JSON.stringify(data))
    toast.success(`Share link: /playground?shared=${id}`)
  }, [messages, toast])

  return (
    <div className="min-h-screen bg-void flex flex-col">
      <header className="sticky top-0 z-30 bg-void/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ModelSelector model={model} setModel={setModel} />
            <button
              onClick={() => setParamsOpen(!paramsOpen)}
              className={`p-2.5 rounded-full border transition-all ${paramsOpen ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-border text-zinc-500 hover:text-accent'}`}
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${webSearchEnabled ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-border text-zinc-500 hover:text-accent'}`}
              title="Toggle web search"
            >
              <Search className="w-4 h-4" />
              Web Search
            </button>
            {searching && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-accent">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Searching web...
              </div>
            )}
            <StatsBar messages={messages} />
            {messages.length > 0 && (
              <>
                <button onClick={shareConversation} className="p-2 text-zinc-500 hover:text-accent transition-colors" title="Share">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={exportConversation} className="p-2 text-zinc-500 hover:text-accent transition-colors" title="Export JSON">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={clearChat} className="p-2 text-zinc-500 hover:text-red-400 transition-colors" title="Clear">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence>
          {paramsOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-void/50 backdrop-blur-sm"
                onClick={() => setParamsOpen(false)}
              />
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed left-0 top-[73px] bottom-0 w-80 bg-panel border-r border-border z-50 overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-syne font-bold text-lg text-text">Parameters</h2>
                    <button onClick={() => setParamsOpen(false)} className="p-2 text-zinc-500 hover:text-accent">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </div>
                  <SettingsPanel
                    temperature={temperature} setTemperature={setTemperature}
                    topP={topP} setTopP={setTopP}
                    maxTokens={maxTokens} setMaxTokens={setMaxTokens}
                    topK={topK} setTopK={setTopK}
                    freqPenalty={freqPenalty} setFreqPenalty={setFreqPenalty}
                    presPenalty={presPenalty} setPresPenalty={setPresPenalty}
                    stream={stream} setStream={setStream}
                    showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
                    model={model}
                  />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {messages.length === 0 ? (
              <EmptyState onPreset={handlePreset} />
            ) : (
              <div className="space-y-8">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    msg={msg}
                    loading={loading}
                    onCopy={handleCopy}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="sticky bottom-0 bg-void/80 backdrop-blur-xl border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center justify-between px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          <MessageInput
            input={input}
            setInput={setInput}
            onSubmit={sendMessage}
            onStop={stopGeneration}
            loading={loading}
          />

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-zinc-600">
              Press Enter to send. Shift+Enter for new line.
            </p>
            <CostEstimate inputText={input} model={model} />
          </div>
        </div>
      </footer>
    </div>
  )
}