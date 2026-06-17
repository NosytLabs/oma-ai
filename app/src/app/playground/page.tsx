'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback, useDeferredValue, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { m, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  X,
  Trash2,
  Settings2,
  Search,
  Download,
  TerminalSquare,
  AlertCircle,
  CheckCircle2,
  Share2,
  Columns2,
  Keyboard,
} from 'lucide-react'

const LazyWelcomeBanner = dynamic(
  () => import('@/components/playground/WelcomeBanner').then(mod => mod.WelcomeBanner),
  { ssr: false, loading: () => null }
)

const LazyExampleConversations = dynamic(
  () => import('@/components/playground/ExampleConversations').then(mod => mod.ExampleConversations),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)

const LazyKeyboardShortcutsModal = dynamic(
  () => import('@/components/playground/KeyboardShortcutsModal').then(mod => mod.KeyboardShortcutsModal),
  { ssr: false, loading: () => null }
)

const LazyModelComparePanel = dynamic(
  () => import('@/components/playground/ModelComparePanel').then(mod => mod.ModelComparePanel),
  { ssr: false, loading: () => null }
)

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

const LazyMobileStatsBar = dynamic(
  () => import('@/components/playground/PlaygroundComponents').then(mod => mod.MobileStatsBar),
  { ssr: false, loading: () => null }
)

import {
  Message,
  SearchResult,
  ExampleConversation,
} from '@/components/playground'
import { A2UIRenderer, isA2UI } from '@/components/playground/A2UIRenderer'
import { CostEstimate } from '@/components/playground/MessageInput';
import { estimateTokens } from '@/lib/text';
import { btnBase } from '@/components/playground/PlaygroundComponents';
import { ChevronDown, ChevronUp } from 'lucide-react'

const STORAGE_KEY = 'oma_playground_conversation'
const SYSTEM_PROMPT_KEY = 'oma_playground_system_prompt'
const CONVERSATION_ID_KEY = 'oma_playground_conversation_id'
const API_URL = '/api/v1/chat/completions'
const MAX_MESSAGE_LENGTH = 100 * 1024
const BATCH_INTERVAL_MS = 250

function genConversationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/** Safe JSON parse that returns null on failure or non-object input. */
function safeJsonParse(s: string): unknown {
  try {
    const v = JSON.parse(s)
    if (v && typeof v === 'object') return v
    return null
  } catch {
    return null
  }
}

// ponytail: SSE events end with \n\n. A single event can have multiple
// `data:` lines that must be concatenated. Per the SSE spec, ignore lines
// starting with `:` (comment). A bare `data:` line is treated as the string
// "data: ". The event ends at the first blank line.
function parseSSEBlock(block: string): { event?: string; data: string[]; id?: string } | null {
  if (!block || block.trim() === "") return null
  const lines = block.split("\n")
  const data: string[] = []
  let event: string | undefined
  let id: string | undefined
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue
    const colon = line.indexOf(":")
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "")
    if (field === "data") data.push(value)
    else if (field === "event") event = value
    else if (field === "id") id = value
  }
  if (data.length === 0 && !event && !id) return null
  return { event, data, id }
}

function PlaygroundContent() {
  const searchParams = useSearchParams()
  const defaultModel = searchParams.get('model') || 'llama-3.2-3b'
  const [model, setModel] = useState(defaultModel)
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
  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)

  // Status states for buttons
  const [exportStatus, setExportStatus] = useState<'default'|'loading'|'success'|'error'>('default')
  const [shareStatus, setShareStatus] = useState<'default'|'success'|'error'>('default')

  // New: Welcome banner, examples, compare mode, shortcuts modal, conversation ID
  const [compareMode, setCompareMode] = useState(false)
  const [compareModel, setCompareModel] = useState('claude-sonnet-4')
  const [compareMessages, setCompareMessages] = useState<Message[]>([])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string>('')

  const toast = useToast()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<Message[]>(messages)

  const deferredMessages = useDeferredValue(messages)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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
    const storedPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY)
    if (storedPrompt) {
      setSystemPrompt(storedPrompt)
      setSystemPromptOpen(true)
    }
    let storedCid = localStorage.getItem(CONVERSATION_ID_KEY)
    if (!storedCid) {
      storedCid = genConversationId()
      try { localStorage.setItem(CONVERSATION_ID_KEY, storedCid) } catch {}
    }
    setConversationId(storedCid)
  }, [])

  useEffect(() => {
    try {
      if (systemPrompt) {
        localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt)
      } else {
        localStorage.removeItem(SYSTEM_PROMPT_KEY)
      }
    } catch {}
  }, [systemPrompt])

  const debouncedSave = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    return (msgs: Message[]) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
        } catch (err) {
          console.warn('Failed to save conversation to storage:', err)
        }
      }, 2000)
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      debouncedSave(messages)
    }
  }, [messages, debouncedSave])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Keyboard shortcuts: Cmd+K (model picker), Cmd+/ (settings), Cmd+Enter (send), ? (shortcuts modal)
  const sendMessageRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    const modKey = isMac ? 'metaKey' : 'ctrlKey'

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inTextField = !!target && (
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable
      )

      if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !inTextField) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }

      if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false)
        else if (paramsOpen) setParamsOpen(false)
        else if (compareMode) setCompareMode(false)
        return
      }

      if (e[modKey as 'metaKey' | 'ctrlKey'] && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        // Focus the model selector by clicking it. We dispatch a custom event
        // that the ModelSelector listens to (or we just click the toolbar's
        // model selector button). For now, focus the first toolbar button.
        const buttons = document.querySelectorAll<HTMLButtonElement>('header[aria-label="Playground toolbar"] button[aria-label="Select AI model"]')
        buttons[0]?.click()
        return
      }

      if (e[modKey as 'metaKey' | 'ctrlKey'] && e.key === '/') {
        e.preventDefault()
        setParamsOpen((v) => !v)
        return
      }

      if (e[modKey as 'metaKey' | 'ctrlKey'] && e.key === 'Enter') {
        e.preventDefault()
        if (input.trim() && !loading) {
          void sendMessageRef.current()
        }
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [input, loading, paramsOpen, compareMode, shortcutsOpen, sendMessageRef])

  // Helper: fetch web search results via Tinyfish MCP-backed /api/v1/search proxy.
  // Returns an empty array on failure / 404 / no key. Sets `searching` for the
  // primary panel and `searchingCompare` for the compare panel.
  const fetchWebSearch = useCallback(async (
    query: string,
    setSearchingFn: (b: boolean) => void,
  ): Promise<{ results: SearchResult[]; contextMessage: Message | null }> => {
    if (!webSearchEnabled || !query.trim()) {
      return { results: [], contextMessage: null }
    }
    setSearchingFn(true)
    try {
      const searchResp = await fetch(`/api/v1/search?query=${encodeURIComponent(query.trim())}`, {
        credentials: 'include',
      })
      if (searchResp.status === 404) {
        toast.info('Web search is not yet available on this deployment')
        return { results: [], contextMessage: null }
      }
      if (!searchResp.ok) {
        toast.error(`Web search failed (${searchResp.status})`)
        return { results: [], contextMessage: null }
      }
      const searchData = await searchResp.json()
      const rawResults = (searchData?.results ?? []) as Array<{
        title: string
        url: string
        snippet: string
        site_name?: string
        favicon?: string
      }>
      if (rawResults.length === 0) {
        return { results: [], contextMessage: null }
      }
      const results: SearchResult[] = rawResults.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        favicon: r.favicon,
      }))
      const contextMessage: Message = {
        role: 'system',
        content: `Web search results for "${query.trim()}":\n\n${rawResults.map((r) =>
          `- ${r.title}\n  ${r.snippet}\n  Source: ${r.url}${r.site_name ? ` (${r.site_name})` : ''}`
        ).join('\n\n')}`,
        timestamp: Date.now(),
      }
      return { results, contextMessage }
    } catch (err) {
      console.warn('Web search failed:', err)
      toast.error('Web search unavailable — proceeding without search results')
      return { results: [], contextMessage: null }
    } finally {
      setSearchingFn(false)
    }
  }, [webSearchEnabled, toast])

  // Helper: stream a chat completion against /api/v1/chat/completions.
  // The caller passes the setter to update (primary `setMessages` or
  // compare `setCompareMessages`). Returns when streaming is complete.
  const streamChatCompletion = useCallback(async (params: {
    model: string
    history: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    searchContext: Message | null
    searchResults: SearchResult[]
    signal: AbortSignal
  }): Promise<void> => {
    const { model: useModel, history, setMessages: setMsgs, searchContext, searchResults, signal } = params

    let messagesToSend = history
    if (searchContext) {
      messagesToSend = [searchContext, ...history]
    }
    if (systemPrompt.trim()) {
      const sysMsg: Message = {
        role: 'system',
        content: systemPrompt.trim(),
        timestamp: Date.now(),
      }
      messagesToSend = [sysMsg, ...messagesToSend]
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        messages: messagesToSend.map(m => ({ role: m.role, content: m.content })),
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        top_k: topK,
        frequency_penalty: freqPenalty,
        presence_penalty: presPenalty,
        stream,
      }),
      signal,
    })

    if (response.status === 401) {
      throw new Error('Connect your wallet to generate an API key')
    }
    if (!response.ok) {
      const errBody = await response.json().catch(() => null)
      const errMsg = errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`
      throw new Error(errMsg)
    }

    const startTime = Date.now()

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
          setMsgs(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: accumulated,
                tokens: tokenCount,
                latency: now - startTime,
                searchResults: searchResults.length > 0 ? searchResults : updated[lastIdx].searchResults,
              }
            }
            return updated
          })
        }
      }

      let sseBuffer = ''
      const processData = (raw: string) => {
        const data = raw.trim()
        if (!data || data === '[DONE]') return
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
        } catch (err) {
          console.warn('Failed to parse streaming response:', err)
        }
      }
      const handleBlock = (block: string) => {
        const parsed = parseSSEBlock(block)
        if (!parsed) return
        for (const d of parsed.data) {
          processData(d)
        }
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        sseBuffer += decoder.decode(value, { stream: true })

        let blocks: string[]
        if (sseBuffer.includes('\n\n')) {
          const parts = sseBuffer.split('\n\n')
          sseBuffer = parts.pop() ?? ''
          blocks = parts
        } else if (sseBuffer.includes('\n')) {
          const parts = sseBuffer.split('\n')
          sseBuffer = parts.pop() ?? ''
          blocks = parts
        } else {
          continue
        }
        for (const block of blocks) handleBlock(block)
      }
      if (sseBuffer.trim()) {
        handleBlock(sseBuffer)
        sseBuffer = ''
      }
      flushToState(true)
    } else {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      setMsgs(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (lastIdx >= 0) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content,
            tokens: data.usage?.total_tokens || 0,
            latency: Date.now() - startTime,
            searchResults: searchResults.length > 0 ? searchResults : updated[lastIdx].searchResults,
          }
        }
        return updated
      })
    }
  }, [systemPrompt, temperature, topP, maxTokens, topK, freqPenalty, presPenalty, stream])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return
    const promptText = input.trim()

    const userMessage: Message = {
      role: 'user',
      content: promptText,
      timestamp: Date.now(),
      inputTokens: estimateTokens(promptText),
    }

    const currentMessages = messagesRef.current
    const allMessages = [...currentMessages, userMessage]
    setMessages(allMessages)
    setInput('')
    setLoading(true)
    setError(null)

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages([...allMessages, assistantMessage])

    // Build compare side: add user message + empty assistant message so the
    // panel mirrors the conversation shape.
    let compareAllMessages: Message[] = []
    if (compareMode) {
      compareAllMessages = [...compareMessages, userMessage]
      setCompareMessages(compareAllMessages)
      setCompareMessages([
        ...compareAllMessages,
        { role: 'assistant', content: '', timestamp: Date.now() + 1 },
      ])
    }

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const primarySearch = await fetchWebSearch(promptText, setSearching)
      const compareSearch = compareMode
        ? await fetchWebSearch(promptText, () => {})
        : { results: [], contextMessage: null }

      // Fire both streams in parallel
      const primaryPromise = streamChatCompletion({
        model,
        history: allMessages,
        setMessages,
        searchContext: primarySearch.contextMessage,
        searchResults: primarySearch.results,
        signal: abortController.signal,
      })

      const comparePromise = compareMode
        ? streamChatCompletion({
            model: compareModel,
            history: compareAllMessages,
            setMessages: setCompareMessages,
            searchContext: compareSearch.contextMessage,
            searchResults: compareSearch.results,
            signal: abortController.signal,
          })
        : Promise.resolve()

      await Promise.all([primaryPromise, comparePromise])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.content === '') {
            return updated.slice(0, -1)
          }
          return updated
        })
        if (compareMode) {
          setCompareMessages(prev => {
            const updated = [...prev]
            if (updated[updated.length - 1]?.content === '') {
              return updated.slice(0, -1)
            }
            return updated
          })
        }
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
        if (compareMode) {
          setCompareMessages(prev => {
            const updated = [...prev]
            if (updated[updated.length - 1]?.content === '') {
              return updated.slice(0, -1)
            }
            return updated
          })
        }
      }
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [
    input,
    loading,
    model,
    compareMode,
    compareModel,
    compareMessages,
    fetchWebSearch,
    streamChatCompletion,
  ])

  sendMessageRef.current = sendMessage

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

  const handleExampleSelect = useCallback((example: ExampleConversation) => {
    setInput(example.prompt)
    setModel(example.model)
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

  // Share: build a replay link with the conversation id + message count and
  // copy it to the clipboard. The id is generated once per browser and
  // persisted in localStorage so reloading keeps the same id.
  const shareConversation = useCallback(async () => {
    let cid = conversationId
    if (!cid) {
      cid = genConversationId()
      setConversationId(cid)
      try { localStorage.setItem(CONVERSATION_ID_KEY, cid) } catch {}
    }
    const userMessageCount = messages.filter(m => m.role === 'user').length
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/playground?cid=${encodeURIComponent(cid)}&msgs=${userMessageCount}&model=${encodeURIComponent(model)}`
    setShareStatus('default')
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('success')
      toast.success('Replay link copied to clipboard')
      setTimeout(() => setShareStatus('default'), 2000)
    } catch {
      setShareStatus('error')
      toast.error('Could not copy share link — check clipboard permissions')
      setTimeout(() => setShareStatus('default'), 2000)
    }
  }, [conversationId, messages, model, toast])

  return (
    <div className="min-h-dvh h-dvh w-full flex flex-col bg-void text-text-secondary font-mono overflow-hidden">
      <h1 className="sr-only">OMA API Playground</h1>
      {/* Top Nav/Toolbar */}
      <header aria-label="Playground toolbar" className="flex-none h-12 border-b border-border flex items-center justify-between px-4 bg-void/95">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-orange mr-4">
            <TerminalSquare className="w-4 h-4" />
            <span className="text-[11px] font-bold tracking-widest uppercase">OMA.WB</span>
          </div>

          <div className="h-4 w-px bg-border hidden md:block" />

          <LazyModelSelector model={model} setModel={setModel} />

          <button
            onClick={() => setParamsOpen(!paramsOpen)}
            className={`${btnBase} ${paramsOpen ? '!bg-surface !text-success !border-success/30' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void`}
            title="Toggle Parameters (Cmd+/)"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PARAMS</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            className={`${btnBase} ${webSearchEnabled ? '!bg-surface !text-success !border-success/30' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void`}
            title="Toggle Web Search (Tinyfish MCP)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WEB</span>
          </button>

          {searching && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-orange uppercase tracking-widest border border-orange/20 bg-orange/10">
              <span className="w-1.5 h-1.5 bg-orange animate-pulse" />
              NET_REQ
            </div>
          )}

          <div className="h-4 w-px bg-border mx-2 hidden md:block" />
          <div className="hidden md:block">
            <LazyStatsBar messages={deferredMessages} model={model} />
          </div>
          <div className="md:hidden">
            <LazyMobileStatsBar messages={deferredMessages} model={model} />
          </div>
          <div className="h-4 w-px bg-border mx-2 hidden md:block" />

          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`${btnBase} ${compareMode ? '!bg-surface !text-success !border-success/30' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void`}
            title="Compare models side-by-side"
            aria-pressed={compareMode}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">COMPARE</span>
          </button>

          <button
            onClick={shareConversation}
            disabled={shareStatus === 'default' && messages.length === 0}
            data-state={shareStatus}
            className={`${btnBase} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void data-[state=success]:text-success data-[state=success]:border-success/30 data-[state=success]:bg-success/10`}
            title="Copy replay link to this conversation"
          >
            {shareStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
             shareStatus === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
             <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">SHARE</span>
          </button>

          <button
            onClick={() => setShortcutsOpen(true)}
            className={`${btnBase} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void`}
            title="Keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">?</span>
          </button>

          {messages.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={exportConversation}
                disabled={exportStatus === 'loading'}
                data-state={exportStatus}
                className={`${btnBase} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void data-[state=loading]:bg-accent/20 data-[state=loading]:text-accent`}
                title="Export"
              >
                {exportStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 exportStatus === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                 <Download className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={clearChat}
                className={`${btnBase} hover:!text-error hover:!border-error/20 hover:!bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void`}
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden bg-void">
        {/* Chat Area */}
        <main aria-label="Chat messages" className="flex-1 flex flex-col min-w-0 border-r border-border relative">
          <div className="flex-none border-b border-border bg-void">
            <button
              onClick={() => setSystemPromptOpen(!systemPromptOpen)}
              aria-expanded={systemPromptOpen}
              aria-label="Toggle system prompt"
              className="w-full flex items-center justify-between px-4 md:px-8 py-2 text-[10px] font-mono text-text-muted uppercase tracking-widest hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${systemPrompt.trim() ? 'bg-success' : 'bg-surface-elevated'}`} />
                SYSTEM PROMPT {systemPrompt.trim() ? '· SET' : '· OPTIONAL'}
              </span>
              {systemPromptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {systemPromptOpen && (
              <div className="px-4 md:px-8 pb-3">
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Set behavior, persona, or instructions for the model. Sent as the first message of every request."
                  aria-label="System prompt"
                  rows={3}
                  className="w-full resize-y bg-surface border border-border px-3 py-2 text-xs text-text-secondary font-mono leading-relaxed placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                  style={{ minHeight: '60px', maxHeight: '160px' }}
                />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent relative">
            <div className="pointer-events-none absolute inset-0 bg-grid-animated mask-radial" aria-hidden="true" />
            <div className="max-w-4xl mx-auto relative z-0">
              {deferredMessages.length === 0 ? (
                <>
                  <LazyWelcomeBanner
                    onSelectExample={() => {
                      const el = document.getElementById('example-conversations')
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    onGetStarted={() => {
                      inputRef.current?.focus()
                    }}
                  />
                  <div id="example-conversations" className="pt-6">
                    <LazyEmptyState onPreset={handlePreset} />
                  </div>
                  <LazyExampleConversations onSelect={handleExampleSelect} />
                </>
              ) : (
                <div className="space-y-8 pb-12">
                  <AnimatePresence mode="popLayout">
                  {deferredMessages.map((msg) => {
                    const trimmed = msg.content.trimStart()
                    const looksLikeA2UI = trimmed.startsWith('{') && isA2UI(safeJsonParse(trimmed))
                    if (looksLikeA2UI) {
                      const parsed = safeJsonParse(trimmed)
                      return (
                        <div key={`${msg.role}-${msg.timestamp}`} className="flex gap-4">
                          <A2UIRenderer payload={parsed} />
                        </div>
                      )
                    }
                    return (
                      <LazyChatMessage
                        key={`${msg.role}-${msg.timestamp}`}
                        msg={msg}
                        loading={loading}
                        onCopy={handleCopy}
                      />
                    )
                  })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-none p-4 bg-void border-t border-border">
            <div className="max-w-4xl mx-auto">
              {error && (
                <div className="mb-3 flex items-center justify-between px-3 py-2 bg-error/10 border border-error/20 text-[11px] text-error uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>ERR: {error}</span>
                    {error.includes('API key') && (
                      <Link
                        href="/dashboard/api-keys"
                        className="ml-2 px-2 py-0.5 bg-accent text-text-inverse text-[10px] font-bold uppercase tracking-wider hover:bg-accent-hover transition-colors"
                      >
                        Get API Key →
                      </Link>
                    )}
                    {error.includes('Connect your wallet') && (
                      <Link
                        href="/login"
                        className="ml-2 px-2 py-0.5 bg-accent text-text-inverse text-[10px] font-bold uppercase tracking-wider hover:bg-accent-hover transition-colors"
                      >
                        Connect Wallet →
                      </Link>
                    )}
                    {error.includes('network') && (
                      <span className="ml-2 px-2 py-0.5 bg-warning/20 text-warning/90 text-[10px] font-semibold uppercase tracking-wider">
                        NETWORK ISSUE
                      </span>
                    )}
                    {error.includes('rate limit') && (
                      <span className="ml-2 px-2 py-0.5 bg-warning/20 text-warning/90 text-[10px] font-semibold uppercase tracking-wider">
                        RATE LIMIT
                      </span>
                    )}
                    {error.includes('model') && (
                      <span className="ml-2 px-2 py-0.5 bg-warning/20 text-warning/90 text-[10px] font-semibold uppercase tracking-wider">
                        MODEL ERROR
                      </span>
                    )}
                  </div>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-error/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void">
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
                <p className="text-[10px] text-text-muted uppercase tracking-widest">
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
            <m.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="flex-none bg-void border-l border-border z-10 overflow-hidden hidden md:flex flex-col"
            >
              <div className="w-80 flex flex-col h-full">
                <div className="flex-none h-12 border-b border-border flex items-center justify-between px-4">
                  <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Model Parameters</h2>
                  <button onClick={() => setParamsOpen(false)} className="text-text-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
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
            </m.aside>
          )}
        </AnimatePresence>

        {/* Mobile Settings Modal Overlay */}
        <AnimatePresence>
          {paramsOpen && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-overlay/80 backdrop-blur-sm"
              onClick={() => setParamsOpen(false)}
            />
          )}
        </AnimatePresence>
        
        {/* Mobile Settings Panel */}
        <AnimatePresence>
          {paramsOpen && (
            <m.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed inset-y-0 right-0 w-80 bg-void border-l border-border z-50 flex flex-col"
            >
              <div className="flex-none h-12 border-b border-border flex items-center justify-between px-4 bg-void">
                <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Parameters</h2>
                <button onClick={() => setParamsOpen(false)} className="text-text-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void">
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
            </m.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcuts modal (triggered by ? or Cmd+/) */}
      <LazyKeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Model comparison panel — only mounted when compare mode is on. The
          panel reuses the same prompt from the main input, fired via
          sendMessage in parallel for both models. */}
      <LazyModelComparePanel
        open={compareMode}
        onClose={() => setCompareMode(false)}
        primaryModel={model}
        compareModel={compareModel}
        setCompareModel={setCompareModel}
        prompt={input}
        onSubmit={() => {
          if (input.trim() && !loading) {
void sendMessageRef.current()
          }
        }}
        loading={loading}
        primaryMessages={messages}
        compareMessages={compareMessages}
        inputDisabled={false}
      />
    </div>
  )
}

function PlaygroundLoadingFallback() {
  return (
    <div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4">
        <Skeleton className="w-10 h-10 shrink-0 rounded" />
        <div className="flex flex-col max-w-[80%] gap-2 flex-1">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<PlaygroundLoadingFallback />}>
      <PlaygroundContent />
    </Suspense>
  )
}
