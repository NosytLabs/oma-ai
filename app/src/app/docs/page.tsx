'use client'

import DOMPurify from 'dompurify'
import { useState, useCallback, useEffect } from 'react'
import {
  Terminal,
  Key,
  Cpu,
  AlertCircle,
  Zap,
  Copy,
  Check,
  Image as ImageIcon,
  FileCode2,
  ArrowRight,
  BookOpen,
  DollarSign,
  Shield,
  Menu,
  X,
  Coins,
  Mic,
  Wallet,
  ChevronRight,
} from 'lucide-react'

type DocsSection =
  | 'quick-start'
  | 'authentication'
  | 'chat-completions'
  | 'completions'
  | 'models-endpoint'
  | 'embeddings'
  | 'image-generation'
  | 'audio-speech'
  | 'payments'
  | 'error-codes'
  | 'x402'

const SECTIONS: { id: DocsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'quick-start', label: 'Quick Start', icon: <Zap className="h-4 w-4" /> },
  { id: 'authentication', label: 'Authentication', icon: <Key className="h-4 w-4" /> },
  { id: 'chat-completions', label: 'Chat Completions', icon: <Terminal className="h-4 w-4" /> },
  { id: 'completions', label: 'Completions', icon: <FileCode2 className="h-4 w-4" /> },
  { id: 'models-endpoint', label: 'Models', icon: <Cpu className="h-4 w-4" /> },
  { id: 'embeddings', label: 'Embeddings', icon: <FileCode2 className="h-4 w-4" /> },
  { id: 'image-generation', label: 'Image Generation', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'audio-speech', label: 'Audio / Speech', icon: <Mic className="h-4 w-4" /> },
  { id: 'payments', label: 'Payments', icon: <Coins className="h-4 w-4" /> },
  { id: 'error-codes', label: 'Error Codes', icon: <AlertCircle className="h-4 w-4" /> },
  { id: 'x402', label: 'x402 Protocol', icon: <Shield className="h-4 w-4" /> },
]

const MODELS = [
  { id: 'qwen-3.5-9b', name: 'Qwen 3.5 9B', context: '32K', input: '$0.05', output: '$0.10', provider: 'AntSeed', badge: 'Budget' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', context: '128K', input: '$0.05', output: '$0.10', provider: 'AntSeed', badge: 'Budget' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', context: '128K', input: '$0.30', output: '$0.60', provider: 'Venice AI', badge: 'Popular' },
  { id: 'llama-4-scout-17b', name: 'Llama 4 Scout 17B', context: '128K', input: '$0.10', output: '$0.20', provider: 'AntSeed', badge: 'Open' },
  { id: 'mistral-small-3.1', name: 'Mistral Small 3.1', context: '128K', input: '$0.08', output: '$0.16', provider: 'AntSeed', badge: 'Open' },
  { id: 'phi-4', name: 'Phi-4', context: '16K', input: '$0.04', output: '$0.08', provider: 'AntSeed', badge: 'Tiny' },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', context: '128K', input: '$0.15', output: '$0.30', provider: 'AntSeed', badge: 'Open' },
  { id: 'qwen-2.5-72b', name: 'Qwen 2.5 72B', context: '128K', input: '$0.30', output: '$0.60', provider: 'AntSeed', badge: 'Large' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', context: '128K', input: '$0.27', output: '$1.10', provider: 'Venice AI', badge: 'Value' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', context: '128K', input: '$0.55', output: '$2.19', provider: 'Venice AI', badge: 'Reasoning' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', context: '128K', input: '$0.15', output: '$0.60', provider: 'Venice AI', badge: 'Fast' },
  { id: 'gpt-4o', name: 'GPT-4o', context: '128K', input: '$2.50', output: '$10.00', provider: 'Venice AI', badge: 'Frontier' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context: '200K', input: '$3.00', output: '$15.00', provider: 'Venice AI', badge: 'Frontier' },
  { id: 'mistral-large', name: 'Mistral Large', context: '128K', input: '$2.00', output: '$6.00', provider: 'Venice AI', badge: 'Frontier' },
  { id: 'qwen-3-235b', name: 'Qwen 3 235B', context: '128K', input: '$0.40', output: '$0.80', provider: 'Venice AI', badge: 'Large' },
]

const ERROR_CODES = [
  { code: 400, type: 'bad_request', desc: 'Invalid request body. Check JSON syntax and parameter types.' },
  { code: 401, type: 'authentication_error', desc: 'Invalid or missing API key. Check your Authorization header.' },
  { code: 402, type: 'insufficient_credits', desc: 'Account balance too low. Deposit more credits to continue.' },
  { code: 403, type: 'forbidden', desc: 'API key has been revoked or does not have access to this resource.' },
  { code: 404, type: 'not_found', desc: 'Model not found or endpoint does not exist.' },
  { code: 429, type: 'rate_limit', desc: 'Too many requests. Implement exponential backoff and retry.' },
  { code: 500, type: 'server_error', desc: 'Internal server error. Retry after a brief wait.' },
  { code: 503, type: 'unavailable', desc: 'Service temporarily unavailable. All providers are down.' },
]

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocsSection>('quick-start')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const scrollToSection = useCallback((id: DocsSection) => {
    setActiveSection(id)
    setMobileNavOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as DocsSection)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <span>Docs</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-indigo-600 font-medium">{SECTIONS.find((s) => s.id === activeSection)?.label}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            API Documentation
          </h1>
          <p className="mt-2 text-slate-600">OpenAI-compatible API. Venice-powered privacy. Drop-in replacement with low-friction onboarding.</p>
        </div>

        <div className="mb-6 flex items-center justify-between lg:hidden">
          <span className="text-sm font-medium text-slate-900">{SECTIONS.find((s) => s.id === activeSection)?.label}</span>
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex gap-8">
          <nav className={`shrink-0 lg:block ${mobileNavOpen ? 'block' : 'hidden'}`}>
            <div className="sticky top-8 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <BookOpen className="h-4 w-4" />
                Navigation
              </div>
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    activeSection === s.id
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1 space-y-12">
            <section id="quick-start"><QuickStartSection /></section>
            <section id="authentication"><AuthenticationSection /></section>
            <section id="chat-completions"><ChatCompletionsSection /></section>
            <section id="completions"><CompletionsSection /></section>
            <section id="models-endpoint"><ModelsEndpointSection /></section>
            <section id="embeddings"><EmbeddingsSection /></section>
            <section id="image-generation"><ImageGenerationSection /></section>
            <section id="audio-speech"><AudioSpeechSection /></section>
            <section id="payments"><PaymentsSection /></section>
            <section id="error-codes"><ErrorCodesSection /></section>
            <section id="x402"><X402Section /></section>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      </div>
      <p className="text-slate-600">{subtitle}</p>
    </div>
  )
}

function CodeBlock({ lang, title, code }: { lang: string; title: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="text-sm font-medium text-slate-600">{title}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-2 py-1 font-mono text-xs text-indigo-700">{lang}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white hover:text-indigo-600"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto bg-slate-900 p-4 text-sm leading-relaxed">
        <code className="font-mono text-slate-100">
          <SyntaxHighlightedCode code={code} lang={lang} />
        </code>
      </pre>
    </div>
  )
}

function TabbedCodeBlock({ tabs }: { tabs: { label: string; lang: string; code: string }[] }) {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex border-b border-slate-100 bg-slate-50">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === i
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="overflow-x-auto bg-slate-900 p-4 text-sm leading-relaxed">
          <code className="font-mono text-slate-100">
            <SyntaxHighlightedCode code={tabs[activeTab].code} lang={tabs[activeTab].lang} />
          </code>
        </pre>
        <CopyButton text={tabs[activeTab].code} />
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return (
    <button
      onClick={handleCopy}
      className="absolute right-3 top-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-400"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function SyntaxHighlightedCode({ code, lang }: { code: string; lang: string }) {
  const lines = code.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const highlighted = highlightLine(line, lang)
        const sanitized = typeof window !== 'undefined' ? DOMPurify.sanitize(highlighted, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] }) : highlighted
        return (
          <div key={i} className="flex">
            <span className="mr-6 inline-block w-8 select-none text-right text-slate-500">{i + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: sanitized }} />
          </div>
        )
      })}
    </>
  )
}

function highlightLine(line: string, lang: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let result = esc(line)

  const kw = (s: string) => `<span class="text-blue-400">${s}</span>`
  const str = (s: string) => `<span class="text-emerald-400">${s}</span>`
  const num = (s: string) => `<span class="text-amber-400">${s}</span>`
  const cmt = (s: string) => `<span class="text-slate-500 italic">${s}</span>`
  const fn = (s: string) => `<span class="text-violet-400">${s}</span>`

  if (lang === 'python') {
    result = result.replace(/\b(from|import|as|def|return|if|else|for|in|class|with|try|except|finally|async|await|True|False|None)\b/g, (_, w) => kw(esc(w)))
    result = result.replace(/(["'])(?:(?!\1).)*\1/g, (m) => str(esc(m)))
    result = result.replace(/\b(\d+\.?\d*)\b/g, (_, n) => num(n))
    result = result.replace(/(#.*)$/gm, (_, c) => cmt(esc(c)))
    result = result.replace(/\b(print|OpenAI|client|create)\b/g, (_, w) => fn(esc(w)))
  } else if (lang === 'javascript' || lang === 'typescript') {
    result = result.replace(/\b(import|from|export|const|let|var|function|return|if|else|for|of|in|async|await|new|true|false|null|undefined|type|interface)\b/g, (_, w) => kw(esc(w)))
    result = result.replace(/(["'`])(?:(?!\1).)*\1/g, (m) => str(esc(m)))
    result = result.replace(/\b(\d+\.?\d*)\b/g, (_, n) => num(n))
    result = result.replace(/(\/\/.*)$/gm, (_, c) => cmt(esc(c)))
    result = result.replace(/\b(console|OpenAI|client|create|log)\b/g, (_, w) => fn(esc(w)))
  } else if (lang === 'bash' || lang === 'http') {
    result = result.replace(/\b(curl|echo|export|sudo|chmod|mkdir|cd)\b/g, (_, w) => kw(esc(w)))
    result = result.replace(/(-[A-Z])\b/g, (_, f) => `<span class="text-amber-400">${f}</span>`)
    result = result.replace(/(["'])(?:(?!\1).)*\1/g, (m) => str(esc(m)))
    result = result.replace(/(#.*)$/gm, (_, c) => cmt(esc(c)))
  } else if (lang === 'json') {
    result = result.replace(/("[\w-]+")\s*:/g, (_, k) => kw(esc(k)))
    result = result.replace(/:\s*("[^"]*")/g, (_, v) => str(v))
    result = result.replace(/:\s*(\d+\.?\d*)/g, (_, n) => num(n))
    result = result.replace(/:\s*(true|false|null)/g, (_, b) => `<span class="text-amber-400">${b}</span>`)
  }

  return result
}

function QuickStartSection() {
  return (
    <div>
      <SectionHeader
        icon={<Zap className="h-5 w-5" />}
        title="Quick Start"
        subtitle="Get running in under 2 minutes. Three steps: get an API key, fund your balance, make your first request."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
          <h3 className="font-semibold text-slate-900">Base URL</h3>
        </div>
        <CodeBlock lang="http" title="Base URL" code={`https://api.oma-ai.com/v1`} />
        <CodeBlock lang="http" title="Authorization" code={`Authorization: Bearer oma_sk_your_key`} />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">2</span>
          <h3 className="font-semibold text-slate-900">Fund Your Balance</h3>
        </div>
        <p className="mb-3 text-slate-600">Deposit USDC on Base, USDC on Solana, OMA tokens, or swap from 100+ coins via HoudiniSwap.</p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <DollarSign className="h-4 w-4 text-indigo-500" />
          <span>1 credit = $0.01 USD. Minimum deposit: $1.00 USDC.</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">3</span>
          <h3 className="font-semibold text-slate-900">Make Your First Request</h3>
        </div>
        <TabbedCodeBlock
          tabs={[
            {
              label: 'Python',
              lang: 'python',
              code: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.oma-ai.com/v1",
    api_key="oma_sk_your_key_here"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,
            },
            {
              label: 'TypeScript',
              lang: 'typescript',
              code: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.oma-ai.com/v1',
  apiKey: 'oma_sk_your_key_here',
});

const response = await client.chat.completions.create({
  model: 'llama-3.3-70b',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);`,
            },
            {
              label: 'cURL',
              lang: 'bash',
              code: `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
            },
          ]}
        />
      </div>

      <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700">
          <ArrowRight className="h-4 w-4" />
          Drop-In Compatible
        </div>
        <p className="text-sm text-slate-600">
          OMA is fully OpenAI-compatible. Change the base URL and API key -- your existing code works without modification.
          Supports streaming, function calling, JSON mode, and vision.
        </p>
      </div>
    </div>
  )
}

function AuthenticationSection() {
  return (
    <div>
      <SectionHeader
        icon={<Key className="h-5 w-5" />}
        title="Authentication"
        subtitle="All API requests require a Bearer token. Keys are prefixed with oma_sk_ and stored as SHA-256 hashes."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold text-slate-900">SIWE Wallet Login</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">1</span>
            <div>
              <span className="font-semibold">Connect Wallet</span>
              <span className="text-slate-500"> -- EVM (Base) or Solana wallet via MetaMask, Phantom, etc.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">2</span>
            <div>
              <span className="font-semibold">Sign SIWE Message</span>
              <span className="text-slate-500"> -- EIP-4361 Sign-In with Ethereum proves wallet ownership</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">3</span>
            <div>
              <span className="font-semibold">Generate API Key</span>
              <span className="text-slate-500"> -- Create a key from the dashboard. Format: oma_sk_...</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">4</span>
            <div>
              <span className="font-semibold">Use as Bearer Token</span>
              <span className="text-slate-500"> -- Server stores only SHA-256 hash. Key shown once at creation.</span>
            </div>
          </div>
        </div>
      </div>

      <CodeBlock lang="http" title="Authorization Header" code={`Authorization: Bearer oma_sk_your_key_here`} />
      <CodeBlock lang="bash" title="Key Format" code={`oma_sk_abcdefghijklmnopqrstuvwxyz1234567890`} />

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700">
          <AlertCircle className="h-4 w-4" />
          Security Notice
        </div>
        <p className="text-sm text-slate-600">Never expose your API key in client-side code. Use environment variables. Keys are non-recoverable if lost -- generate a new one.</p>
      </div>
    </div>
  )
}

function ChatCompletionsSection() {
  return (
    <div>
      <SectionHeader
        icon={<Terminal className="h-5 w-5" />}
        title="Chat Completions"
        subtitle="POST /v1/chat/completions -- OpenAI-compatible chat endpoint with streaming support."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">POST</span>
          <span className="font-mono text-sm text-slate-900">/v1/chat/completions</span>
        </div>

        <h4 className="mb-3 font-semibold text-slate-900">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 pr-4 font-medium text-slate-500">Parameter</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Type</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Required</th>
                <th className="pb-3 font-medium text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm">
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">model</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Model ID (see Models table)</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">messages</td>
                <td className="py-3 pr-4 text-slate-500">array</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Array of message objects</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">temperature</td>
                <td className="py-3 pr-4 text-slate-500">number</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">0-2, default 1</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">max_tokens</td>
                <td className="py-3 pr-4 text-slate-500">integer</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">Max tokens in completion</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">stream</td>
                <td className="py-3 pr-4 text-slate-500">boolean</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">Enable SSE streaming</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">tools</td>
                <td className="py-3 pr-4 text-slate-500">array</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">Function calling definitions</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-indigo-600">response_format</td>
                <td className="py-3 pr-4 text-slate-500">object</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">JSON mode: {'{"type": "json_object"}'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <TabbedCodeBlock
        tabs={[
          {
            label: 'Python',
            lang: 'python',
            code: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.oma-ai.com/v1",
    api_key="oma_sk_your_key_here"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in 3 sentences."}
    ],
    temperature=0.7,
    max_tokens=200
)

print(response.choices[0].message.content)
print(f"Tokens: {response.usage.total_tokens}")`,
          },
          {
            label: 'TypeScript',
            lang: 'typescript',
            code: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.oma-ai.com/v1',
  apiKey: 'oma_sk_your_key_here',
});

const stream = await client.chat.completions.create({
  model: 'llama-3.3-70b',
  messages: [{ role: 'user', content: 'Write a haiku about code.' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}`,
          },
          {
            label: 'cURL',
            lang: 'bash',
            code: `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7
  }'`,
          },
        ]}
      />

      <h4 className="mb-3 mt-6 font-semibold text-slate-900">Response Format</h4>
      <CodeBlock
        lang="json"
        title="Response Example"
        code={`{
  "id": "oma-abc123",
  "object": "chat.completion",
  "created": 1716123456,
  "model": "llama-3.3-70b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20
  }
}`}
      />
    </div>
  )
}

function CompletionsSection() {
  return (
    <div>
      <SectionHeader
        icon={<FileCode2 className="h-5 w-5" />}
        title="Completions"
        subtitle="POST /v1/completions -- Text completions endpoint. Legacy format, prefer chat completions for new projects."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">POST</span>
          <span className="font-mono text-sm text-slate-900">/v1/completions</span>
        </div>

        <h4 className="mb-3 font-semibold text-slate-900">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 pr-4 font-medium text-slate-500">Parameter</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Type</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Required</th>
                <th className="pb-3 font-medium text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm">
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">model</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Model ID</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">prompt</td>
                <td className="py-3 pr-4 text-slate-500">string/array</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Prompt text(s) to complete</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">max_tokens</td>
                <td className="py-3 pr-4 text-slate-500">integer</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">Max tokens (default 16)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-indigo-600">temperature</td>
                <td className="py-3 pr-4 text-slate-500">number</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">0-2, default 1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://api.oma-ai.com/v1/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "prompt": "The meaning of life is",
    "max_tokens": 50
  }'`}
      />
    </div>
  )
}

function ModelsEndpointSection() {
  return (
    <div>
      <SectionHeader
        icon={<Cpu className="h-5 w-5" />}
        title="Models"
        subtitle="GET /v1/models -- List all available models and their details."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">GET</span>
          <span className="font-mono text-sm text-slate-900">/v1/models</span>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="List Models"
        code={`curl https://api.oma-ai.com/v1/models \\
  -H "Authorization: Bearer oma_sk_your_key_here"`}
      />

      <CodeBlock
        lang="json"
        title="Response Example"
        code={`{
  "object": "list",
  "data": [
    {
      "id": "llama-3.3-70b",
      "object": "model",
      "created": 1716123456,
      "owned_by": "venice"
    },
    {
      "id": "deepseek-r1",
      "object": "model",
      "created": 1716123456,
      "owned_by": "venice"
    }
  ]
}`}
      />

      <h4 className="mb-3 mt-6 font-semibold text-slate-900">Available Models</h4>
      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-4 font-medium text-slate-500">Model</th>
                <th className="px-5 py-4 font-medium text-slate-500">ID</th>
                <th className="px-5 py-4 font-medium text-slate-500">Context</th>
                <th className="px-5 py-4 font-medium text-slate-500">Input/1M</th>
                <th className="px-5 py-4 font-medium text-slate-500">Output/1M</th>
                <th className="px-5 py-4 font-medium text-slate-500">Provider</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{m.name}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{m.badge}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-indigo-600">{m.id}</td>
                  <td className="px-5 py-4 font-mono text-slate-600">{m.context}</td>
                  <td className="px-5 py-4 font-mono text-slate-900">{m.input}</td>
                  <td className="px-5 py-4 font-mono text-slate-900">{m.output}</td>
                  <td className="px-5 py-4 text-slate-500">{m.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-slate-500">Prices in USD credits. OMA stakers receive up to 15% discount on inference.</p>
    </div>
  )
}

function EmbeddingsSection() {
  return (
    <div>
      <SectionHeader
        icon={<FileCode2 className="h-5 w-5" />}
        title="Embeddings"
        subtitle="POST /v1/embeddings -- Generate vector embeddings for text."
      />

      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold text-indigo-700">
          <Zap className="h-4 w-4" />
          Live
        </div>
        <p className="text-sm text-slate-600">Powered by Venice AI. Text-embedding-3-small model. Flat rate: 1 credit per request.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">POST</span>
          <span className="font-mono text-sm text-slate-900">/v1/embeddings</span>
        </div>
        <h4 className="mb-3 font-semibold text-slate-900">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 pr-4 font-medium text-slate-500">Parameter</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Type</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Required</th>
                <th className="pb-3 font-medium text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm">
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">input</td>
                <td className="py-3 pr-4 text-slate-500">string/array</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Text or array of texts to embed</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-indigo-600">model</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Embedding model ID</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://api.oma-ai.com/v1/embeddings \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "text-embedding-3-small",
    "input": "The quick brown fox jumps over the lazy dog"
  }'`}
      />
    </div>
  )
}

function ImageGenerationSection() {
  return (
    <div>
      <SectionHeader
        icon={<ImageIcon className="h-5 w-5" />}
        title="Image Generation"
        subtitle="POST /v1/images/generations -- Generate images from text prompts."
      />

      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold text-indigo-700">
          <Zap className="h-4 w-4" />
          Live
        </div>
        <p className="text-sm text-slate-600">Powered by Venice AI SDXL. Flat rate: 5 credits per image. Supports 1024x1024, 768x768, 512x512.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">POST</span>
          <span className="font-mono text-sm text-slate-900">/v1/images/generations</span>
        </div>
        <h4 className="mb-3 font-semibold text-slate-900">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 pr-4 font-medium text-slate-500">Parameter</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Type</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Required</th>
                <th className="pb-3 font-medium text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm">
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">prompt</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Text description of desired image</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">model</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">Default: sdxl</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">n</td>
                <td className="py-3 pr-4 text-slate-500">integer</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">Number of images (1-4), default 1</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-indigo-600">size</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">1024x1024 (default), 512x512, 768x768</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://api.oma-ai.com/v1/images/generations \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "sdxl",
    "prompt": "A cyberpunk cityscape at sunset",
    "n": 1,
    "size": "1024x1024"
  }'`}
      />
    </div>
  )
}

function AudioSpeechSection() {
  return (
    <div>
      <SectionHeader
        icon={<Mic className="h-5 w-5" />}
        title="Audio / Speech"
        subtitle="POST /v1/audio/speech -- Generate audio from text input."
      />

      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold text-indigo-700">
          <Zap className="h-4 w-4" />
          Live
        </div>
        <p className="text-sm text-slate-600">Powered by Venice AI. OpenAI-compatible TTS. ~1 credit per 1K tokens. Returns raw audio binary.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">POST</span>
          <span className="font-mono text-sm text-slate-900">/v1/audio/speech</span>
        </div>
        <h4 className="mb-3 font-semibold text-slate-900">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 pr-4 font-medium text-slate-500">Parameter</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Type</th>
                <th className="pb-3 pr-4 font-medium text-slate-500">Required</th>
                <th className="pb-3 font-medium text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm">
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">model</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">TTS model ID</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">input</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-amber-600">yes</td>
                <td className="py-3 text-slate-600">Text to convert to speech</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 text-indigo-600">voice</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">Voice preset (alloy, echo, fable, etc.)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-indigo-600">response_format</td>
                <td className="py-3 pr-4 text-slate-500">string</td>
                <td className="py-3 pr-4 text-slate-500">no</td>
                <td className="py-3 text-slate-600">mp3, opus, aac, flac (default mp3)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://api.oma-ai.com/v1/audio/speech \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "tts-1",
    "input": "Hello, this is a test of the OMA speech synthesis.",
    "voice": "alloy"
  }' \\
  --output speech.mp3`}
      />
    </div>
  )
}

function PaymentsSection() {
  return (
    <div>
      <SectionHeader
        icon={<Coins className="h-5 w-5" />}
        title="Payments"
        subtitle="Fund your account with crypto. Credits are 1:1 USD with a 12-month rolling expiry."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Deposit Methods</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-600 text-xs font-bold">$</span>
            <div>
              <span className="font-medium text-slate-900">USDC on Base</span>
              <span className="text-slate-500"> -- Instant, 1:1 credits, 0% fee. Direct transfer on Base L2.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-purple-100 text-purple-600 text-xs font-bold">$</span>
            <div>
              <span className="font-medium text-slate-900">USDC on Solana</span>
              <span className="text-slate-500"> -- Instant, 1:1 credits, 0% fee. Direct transfer on Solana.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">O</span>
            <div>
              <span className="font-medium text-slate-900">OMA Token</span>
              <span className="text-slate-500"> -- Instant at TWAP oracle rate, +5% bonus. Circuit breakers apply.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-600 text-xs font-bold">H</span>
            <div>
              <span className="font-medium text-slate-900">HoudiniSwap</span>
              <span className="text-slate-500"> -- 100+ coins (BTC, XMR, SOL, DOGE, etc.) swapped to USDC on Base. Settlement: 5-45 min.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Credit System</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <span className="text-slate-500">Credit value</span>
            <span className="font-mono font-medium text-slate-900">1:1 USD</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <span className="text-slate-500">Expiry</span>
            <span className="font-mono font-medium text-slate-900">12-month rolling</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <span className="text-slate-500">Transferable</span>
            <span className="font-mono font-medium text-red-600">No</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <span className="text-slate-500">Redeemable</span>
            <span className="font-mono font-medium text-red-600">No</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Expected breakage</span>
            <span className="font-mono font-medium text-slate-900">~5-8%</span>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Staking Discounts</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium text-slate-500">Tier</th>
                <th className="px-4 py-3 font-medium text-slate-500">OMA Staked</th>
                <th className="px-4 py-3 font-medium text-slate-500">Discount</th>
                <th className="px-4 py-3 font-medium text-slate-500">Rate Limit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100"><td className="px-4 py-3 text-slate-600">None</td><td className="px-4 py-3 font-mono">0</td><td className="px-4 py-3 font-mono">0%</td><td className="px-4 py-3 font-mono">1x</td></tr>
              <tr className="border-b border-slate-100"><td className="px-4 py-3 text-slate-600">Bronze</td><td className="px-4 py-3 font-mono">1,000</td><td className="px-4 py-3 font-mono text-indigo-600">3%</td><td className="px-4 py-3 font-mono">1x</td></tr>
              <tr className="border-b border-slate-100"><td className="px-4 py-3 text-slate-600">Silver</td><td className="px-4 py-3 font-mono">10,000</td><td className="px-4 py-3 font-mono text-indigo-600">6%</td><td className="px-4 py-3 font-mono">1.5x</td></tr>
              <tr className="border-b border-slate-100"><td className="px-4 py-3 text-slate-600">Gold</td><td className="px-4 py-3 font-mono">50,000</td><td className="px-4 py-3 font-mono text-indigo-600">10%</td><td className="px-4 py-3 font-mono">1.5x</td></tr>
              <tr><td className="px-4 py-3 text-slate-600">Platinum</td><td className="px-4 py-3 font-mono">100,000</td><td className="px-4 py-3 font-mono text-indigo-600">15%</td><td className="px-4 py-3 font-mono">2x</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-500">Max combined: 20% (5% OMA bonus + 15% staking). Circuit breakers: OMA -20% = 2% bonus, -35% = 0% bonus, -50% = halt OMA deposits.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
          <DollarSign className="h-4 w-4 text-indigo-500" />
          Payment Flow
        </div>
        <div className="space-y-2 text-slate-600">
          <p><span className="font-medium text-slate-900">USDC Direct:</span> 1:1 credits, instant. USDC goes to treasury.</p>
          <p><span className="font-medium text-slate-900">OMA Token:</span> 1:1 + 5% bonus at TWAP oracle rate. 50% burned, 50% treasury.</p>
          <p><span className="font-medium text-slate-900">HoudiniSwap:</span> Swap to USDC on Base. Credits after settlement. HoudiniSwap cannot split to two addresses.</p>
        </div>
      </div>
    </div>
  )
}

function ErrorCodesSection() {
  return (
    <div>
      <SectionHeader
        icon={<AlertCircle className="h-5 w-5" />}
        title="Error Codes"
        subtitle="Standard HTTP error codes returned by the API. All errors include a JSON body with type and message."
      />

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-4 font-medium text-slate-500">Code</th>
              <th className="px-5 py-4 font-medium text-slate-500">Type</th>
              <th className="px-5 py-4 font-medium text-slate-500">Description</th>
            </tr>
          </thead>
          <tbody>
            {ERROR_CODES.map((e) => (
              <tr key={e.code} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                <td className="px-5 py-4 font-mono font-bold text-violet-600">{e.code}</td>
                <td className="px-5 py-4 font-mono text-amber-600">{e.type}</td>
                <td className="px-5 py-4 text-slate-600">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="mb-3 font-semibold text-slate-900">Error Response Format</h4>
      <CodeBlock
        lang="json"
        title="Error Response"
        code={`{
  "error": {
    "type": "insufficient_credits",
    "code": 402,
    "message": "Account balance too low. Current balance: $0.12. Minimum required: $0.01."
  }
}`}
      />

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="mb-3 font-semibold text-slate-900">Handling 429 Rate Limits</h4>
        <CodeBlock
          lang="python"
          title="Retry with Exponential Backoff"
          code={`import time
from openai import OpenAI

client = OpenAI(
    base_url="https://api.oma-ai.com/v1",
    api_key="oma_sk_your_key_here"
)

max_retries = 5
for attempt in range(max_retries):
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[{"role": "user", "content": "Hello!"}]
        )
        break
    except Exception as e:
        if hasattr(e, 'status_code') and e.status_code == 429:
            wait = 2 ** attempt
            print(f"Rate limited. Retrying in {wait}s...")
            time.sleep(wait)
        else:
            raise`}
        />
      </div>
    </div>
  )
}

function X402Section() {
  return (
    <div>
      <SectionHeader
        icon={<Shield className="h-5 w-5" />}
        title="x402 Protocol"
        subtitle="Use OMA as an x402 facilitator for agent-native, per-request payments on Base and Solana."
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-slate-600">
          The x402 protocol enables HTTP 402 Payment Required responses with payment details.
          AI agents can automatically pay for API access using crypto wallets without API keys.
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">1</span>
            <div>
              <span className="font-medium">Agent sends request</span>
              <span className="text-slate-500"> -- Standard HTTP request without Authorization header</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">2</span>
            <div>
              <span className="font-medium">OMA returns 402</span>
              <span className="text-slate-500"> -- HTTP 402 with x402 payment requirements in response body</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">3</span>
            <div>
              <span className="font-medium">Agent pays</span>
              <span className="text-slate-500"> -- Signs EIP-712 payment authorization on Base or Solana</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-xs font-bold">4</span>
            <div>
              <span className="font-medium">Resend with proof</span>
              <span className="text-slate-500"> -- Include payment receipt in X-Payment header. OMA verifies on-chain.</span>
            </div>
          </div>
        </div>
      </div>

      <CodeBlock
        lang="typescript"
        title="x402 Client (Base)"
        code={`import { x402 } from '@x402/hono';

const response = await fetch('https://api.oma-ai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama-3.3-70b',
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
});

if (response.status === 402) {
  const paymentReq = await response.json();
  const payment = await signPayment(paymentReq);
  
  const paid = await fetch('https://api.oma-ai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': JSON.stringify(payment),
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b',
      messages: [{ role: 'user', content: 'Hello!' }],
    }),
  });
}`}
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="mb-3 font-semibold text-slate-900">x402 Pricing</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Read (GET /v1/models)</span>
            <span className="font-mono text-slate-900">$0.0001</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Quote (price check)</span>
            <span className="font-mono text-slate-900">$0.001</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Exchange (inference)</span>
            <span className="font-mono text-slate-900">Model-dependent</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold text-indigo-700">
          <Shield className="h-4 w-4" />
          Live -- Direct HTTP Payments
        </div>
        <p className="text-sm text-slate-600">
          x402 is fully operational on Base and Solana. Send a <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">PAYMENT-SIGNATURE</code>
          header with USDC transfers to pay per-request. No pre-funded account needed.
          See the <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">POST /v1/x402/proxy/chat/completions</code> endpoint for agent-native payments.
        </p>
      </div>
    </div>
  )
}