/* Hallmark · macrostructure: Workbench · theme: Terminal
 * audience: Developers · use case: Test AI models · tone: Technical
 * enrichment: none (typography only)
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

'use client'

import dynamic from 'next/dynamic'
import { useState, useRef, useEffect, useCallback, useDeferredValue } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  X,
  Trash2,
  Settings2,
  Search,
  Share2,
  Download,
  TerminalSquare,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

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

const LazyModelSelector = dynamic(
  () => import('@/components/playground/ModelSelector').then(mod => mod.ModelSelector),
  { ssr: false, loading: () => <Skeleton className="h-8 w-40" /> }
)

const LazyMessageInput = dynamic(
  () => import('@/components/playground/MessageInput').then(mod => mod.MessageInput),
  { ssr: false, loading: () => <Skeleton className="h-16 w-full" /> }
)

const LazySettingsPanel = dynamic(
  () => import('@/components/playground/SettingsPanel').then(mod => mod.SettingsPanel),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
)

const LazyEmptyState = dynamic(
  () => import('@/components/playground/PresetPrompts').then(mod => mod.EmptyState),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)

const LazyStatsBar = dynamic(
  () => import('@/components/playground/PlaygroundComponents').then(mod => mod.StatsBar),
  { ssr: false, loading: () => null }
)

import {
  Message,
  SearchResult,
} from '@/components/playground'
import { CostEstimate, estimateTokens } from '@/components/playground/MessageInput'
import { btnBase } from '@/components/playground/PlaygroundComponents'

const STORAGE_KEY = 'oma_playground_conversation'
const API_URL = '/api/v1/chat/completions'
const MAX_MESSAGE_LENGTH = 100 * 1024
const BATCH_INTERVAL_MS = 250

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
  
  // Status states for buttons
  const [shareStatus, setShareStatus] = useState<'default'|'loading'|'success'|'error'>('default')
  const [exportStatus, setExportStatus] = useState<'default'|'loading'|'success'|'error'>('default')

  const toast = useToast()

  const getApiKeyFromCookie = useCallback(() => {
    const match = document.cookie.match(/oma_api_key=([^;]+)/)
    return match ? match[1] : null
  }, [])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const deferredMessages = useDeferredValue(messages)

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
          headers: { 'Authorization': `Bearer ${getApiKeyFromCookie() || ''}` }
        })
        if (searchResp.ok) {
          const searchData = await searchResp.json()
          if (searchData.results?.length > 0) {
            currentSearchResults = searchData.results.map((r: SearchResult) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              favicon: r.favicon,
            }))
            setSearchResults(currentSearchResults)
            const searchContext: Message = {
              role: 'system',
              content: `Web search results for "${input.trim()}":\n\n${searchData.results.map((r: SearchResult) => 
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
          'Authorization': `Bearer ${getApiKeyFromCookie() || ''}`,
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
        let lastUpdateTime = 0
        let lastFlushedContent = ''

        const flushToState = (force = false) => {
          const now = Date.now()
          if (force || (now - lastUpdateTime >= BATCH_INTERVAL_MS && accumulated !== lastFlushedContent)) {
            lastUpdateTime = now
            lastFlushedContent = accumulated
            setMessages(prev => {
              const updated = [...prev]
              const lastIdx = updated.length - 1
              if (lastIdx >= 0) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: accumulated,
                  tokens: tokenCount,
                  latency: now - startTime,
                  searchResults: lastIdx === updated.length - 1 ? currentSearchResults : updated[lastIdx].searchResults,
                }
              }
              return updated
            })
          }
        }

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
                if (accumulated.length < MAX_MESSAGE_LENGTH) {
                  accumulated += delta
                }
                tokenCount += 1
                flushToState()
              }
            } catch {}
          }
        }
        flushToState(true)
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
  }, [input, loading, messages, model, temperature, topP, maxTokens, topK, freqPenalty, presPenalty, stream, webSearchEnabled, getApiKeyFromCookie])

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
    setExportStatus('loading')
    try {
      const data = JSON.stringify(messages, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `oma-export-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus('success')
      setTimeout(() => setExportStatus('default'), 2000)
    } catch {
      setExportStatus('error')
      setTimeout(() => setExportStatus('default'), 2000)
    }
  }, [messages])

  const shareConversation = useCallback(() => {
    setShareStatus('loading')
    try {
      const id = Math.random().toString(36).slice(2, 10)
      const data = { id, messages }
      localStorage.setItem(`oma_share_${id}`, JSON.stringify(data))
      setShareStatus('success')
      toast.success(`/playground?shared=${id}`)
      setTimeout(() => setShareStatus('default'), 2000)
    } catch {
      setShareStatus('error')
      setTimeout(() => setShareStatus('default'), 2000)
    }
  }, [messages, toast])

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--color-void)] text-[var(--color-text-secondary)] font-mono overflow-hidden">
      {/* Top Nav/Toolbar */}
      <header aria-label="Playground toolbar" className="flex-none h-12 border-b border-[var(--color-border)] flex items-center justify-between px-4 bg-[var(--color-void)]/95">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-emerald-500 mr-4">
            <TerminalSquare className="w-4 h-4" />
            <span className="text-[11px] font-bold tracking-widest uppercase">OMA.WB</span>
          </div>
          
          <div className="h-4 w-px bg-[var(--color-border)] hidden md:block" />
          
          <LazyModelSelector model={model} setModel={setModel} />
          
          <button
            onClick={() => setParamsOpen(!paramsOpen)}
            className={`${btnBase} ${paramsOpen ? '!bg-[var(--color-surface)] !text-[var(--color-success)] !border-[var(--color-success)]/30' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]`}
            title="Toggle Parameters"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PARAMS</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            className={`${btnBase} ${webSearchEnabled ? '!bg-[var(--color-surface)] !text-[var(--color-success)] !border-[var(--color-success)]/30' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]`}
            title="Toggle Web Search"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WEB</span>
          </button>
          
          {searching && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-emerald-500 uppercase tracking-widest border border-emerald-900/50 bg-emerald-950/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
              NET_REQ
            </div>
          )}

          <div className="h-4 w-px bg-[var(--color-border)] mx-2 hidden md:block" />
          
          <LazyStatsBar messages={deferredMessages} model={model} />

          <div className="h-4 w-px bg-[var(--color-border)] mx-2 hidden md:block" />

          {messages.length > 0 && (
            <div className="flex items-center gap-1">
              <button 
                onClick={shareConversation} 
                disabled={shareStatus === 'loading'}
                data-state={shareStatus}
                className={`${btnBase} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]`} 
                title="Share"
              >
                {shareStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 shareStatus === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                 <Share2 className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={exportConversation} 
                disabled={exportStatus === 'loading'}
                data-state={exportStatus}
                className={`${btnBase} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]`} 
                title="Export"
              >
                {exportStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 exportStatus === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                 <Download className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={clearChat} 
                className={`${btnBase} hover:!text-red-400 hover:!border-red-900/50 hover:!bg-red-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]`} 
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden bg-[#050505]">
        {/* Chat Area */}
        <main aria-label="Chat messages" className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-border)] relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent">
            <div className="max-w-4xl mx-auto">
              {deferredMessages.length === 0 ? (
                <LazyEmptyState onPreset={handlePreset} />
              ) : (
                <div className="space-y-8 pb-12">
                  {deferredMessages.map((msg, i) => (
                    <LazyChatMessage
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
          </div>

          {/* Input Area */}
          <div className="flex-none p-4 bg-[var(--color-void)] border-t border-[var(--color-border)]">
            <div className="max-w-4xl mx-auto">
              {error && (
                <div className="mb-3 flex items-center justify-between px-3 py-2 bg-red-950/30 border border-red-900/50 text-[11px] text-red-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>ERR: {error}</span>
                  </div>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]">
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
        </main>

        {/* Settings Panel (Sidebar) */}
        <AnimatePresence initial={false}>
          {paramsOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="flex-none bg-[var(--color-void)] border-l border-[var(--color-border)] z-10 overflow-hidden hidden md:flex flex-col"
            >
              <div className="w-80 flex flex-col h-full">
                <div className="flex-none h-12 border-b border-[var(--color-border)] flex items-center justify-between px-4">
                  <h2 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Model Parameters</h2>
                  <button onClick={() => setParamsOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent">
                  <LazySettingsPanel
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
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile Settings Modal Overlay */}
        <AnimatePresence>
          {paramsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
              onClick={() => setParamsOpen(false)}
            />
          )}
        </AnimatePresence>
        
        {/* Mobile Settings Panel */}
        <AnimatePresence>
          {paramsOpen && (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed inset-y-0 right-0 w-80 bg-[var(--color-void)] border-l border-[var(--color-border)] z-50 flex flex-col"
            >
              <div className="flex-none h-12 border-b border-[var(--color-border)] flex items-center justify-between px-4 bg-[var(--color-void)]">
                <h2 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Parameters</h2>
                <button onClick={() => setParamsOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <LazySettingsPanel
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
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
