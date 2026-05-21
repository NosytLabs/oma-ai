'use client'

import DOMPurify from 'dompurify'
import { useState, useCallback, useEffect, useRef } from 'react'
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
  const contentRef = useRef<HTMLDivElement>(null)

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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">API DOCUMENTATION</h1>
        <p className="mt-2 text-text-dim">OpenAI-compatible. Drop-in replacement.</p>
      </div>

      <div className="mb-6 flex items-center justify-between lg:hidden">
        <span className="text-sm text-text-dim">{SECTIONS.find((s) => s.id === activeSection)?.label}</span>
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="text-text-dim hover:text-text">
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex gap-8">
        <nav className={`shrink-0 lg:block ${mobileNavOpen ? 'block' : 'hidden'}`}>
          <div className="sticky top-20 w-56 space-y-0.5 rounded-xl border border-border bg-panel p-2">
            <div className="mb-2 flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-text-dim">
              <BookOpen className="h-4 w-4" />
              Navigation
            </div>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  activeSection === s.id
                    ? 'bg-cyan/10 text-cyan border border-cyan/20'
                    : 'text-text-dim hover:text-text hover:bg-surface border border-transparent'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <div ref={contentRef} className="min-w-0 flex-1 space-y-16">
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
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan">
          {icon}
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <p className="text-text-dim text-sm">{subtitle}</p>
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
    <div className="overflow-hidden rounded-lg border border-border my-3">
      <div className="flex items-center justify-between border-b border-border bg-panel px-4 py-2">
        <span className="text-xs font-semibold text-text-dim">{title}</span>
        <div className="flex items-center gap-2">
          <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-cyan">{lang}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-text-dim transition-colors hover:bg-surface hover:text-cyan"
            title="Copy code"
          >
            {copied ? <Check className="h-3 w-3 text-green" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto bg-void p-4 text-xs leading-relaxed">
        <code className="font-mono">
          <SyntaxHighlightedCode code={code} lang={lang} />
        </code>
      </pre>
    </div>
  )
}

function TabbedCodeBlock({ tabs }: { tabs: { label: string; lang: string; code: string }[] }) {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="overflow-hidden rounded-lg border border-border my-3">
      <div className="flex items-center border-b border-border bg-panel">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === i
                ? 'border-b-2 border-cyan text-cyan'
                : 'text-text-dim hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="overflow-x-auto bg-void p-4 text-xs leading-relaxed">
          <code className="font-mono">
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
      className="absolute right-3 top-3 rounded border border-border bg-panel px-2 py-1 text-xs text-text-dim transition-colors hover:border-cyan hover:text-cyan"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}
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
            <span className="mr-4 inline-block w-6 select-none text-right text-text-dim/40">{i + 1}</span>
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

  const kw = (s: string) => `<span class="text-cyan">${s}</span>`
  const str = (s: string) => `<span class="text-green">${s}</span>`
  const num = (s: string) => `<span class="text-amber">${s}</span>`
  const cmt = (s: string) => `<span class="text-text-dim italic">${s}</span>`
  const fn = (s: string) => `<span class="text-cyan">${s}</span>`

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
    result = result.replace(/(-[A-Z])\b/g, (_, f) => `<span class="text-amber">${f}</span>`)
    result = result.replace(/(["'])(?:(?!\1).)*\1/g, (m) => str(esc(m)))
    result = result.replace(/(#.*)$/gm, (_, c) => cmt(esc(c)))
  } else if (lang === 'json') {
    result = result.replace(/("[\w-]+")\s*:/g, (_, k) => kw(esc(k)))
    result = result.replace(/:\s*("[^"]*")/g, (_, v) => str(v))
    result = result.replace(/:\s*(\d+\.?\d*)/g, (_, n) => num(n))
    result = result.replace(/:\s*(true|false|null)/g, (_, b) => `<span class="text-amber">${b}</span>`)
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

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan text-void text-xs font-bold">1</span>
          <h3 className="font-bold">Base URL</h3>
        </div>
        <CodeBlock lang="http" title="Base URL" code={`https://oma-ai.com/v1`} />
        <CodeBlock lang="http" title="Authorization" code={`Authorization: Bearer oma_sk_your_key`} />
      </div>

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan text-void text-xs font-bold">2</span>
          <h3 className="font-bold">Fund Your Balance</h3>
        </div>
        <p className="text-sm text-text-dim mb-3">Deposit USDC on Base, USDC on Solana, OMA tokens, or swap from 100+ coins via HoudiniSwap.</p>
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <DollarSign className="h-4 w-4 text-cyan" />
          <span>1 credit = $0.01 USD. Minimum deposit: $1.00 USDC.</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan text-void text-xs font-bold">3</span>
          <h3 className="font-bold">Make Your First Request</h3>
        </div>
        <TabbedCodeBlock
          tabs={[
            {
              label: 'Python',
              lang: 'python',
              code: `from openai import OpenAI

client = OpenAI(
    base_url="https://oma-ai.com/v1",
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
  baseURL: 'https://oma-ai.com/v1',
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
              code: `curl https://oma-ai.com/v1/chat/completions \\
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

      <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-4 text-sm mt-6">
        <div className="flex items-center gap-2 mb-2 font-bold text-cyan">
          <ArrowRight className="h-4 w-4" />
          Drop-In Compatible
        </div>
        <p className="text-text-dim text-xs">
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

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-cyan" />
          <h3 className="font-bold text-sm">SIWE Wallet Login</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">1</span>
            <div>
              <span className="font-semibold">Connect Wallet</span>
              <span className="text-text-dim"> -- EVM (Base) or Solana wallet via MetaMask, Phantom, etc.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">2</span>
            <div>
              <span className="font-semibold">Sign SIWE Message</span>
              <span className="text-text-dim"> -- EIP-4361 Sign-In with Ethereum proves wallet ownership</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">3</span>
            <div>
              <span className="font-semibold">Generate API Key</span>
              <span className="text-text-dim"> -- Create a key from the dashboard. Format: oma_sk_...</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">4</span>
            <div>
              <span className="font-semibold">Use as Bearer Token</span>
              <span className="text-text-dim"> -- Server stores only SHA-256 hash. Key shown once at creation.</span>
            </div>
          </div>
        </div>
      </div>

      <CodeBlock lang="http" title="Authorization Header" code={`Authorization: Bearer oma_sk_your_key_here`} />
      <CodeBlock lang="bash" title="Key Format" code={`oma_sk_abcdefghijklmnopqrstuvwxyz1234567890`} />

      <div className="mt-4 rounded-lg border border-amber/20 bg-amber/5 p-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-amber mb-1">
          <AlertCircle className="h-4 w-4" />
          Security Notice
        </div>
        <p className="text-text-dim">Never expose your API key in client-side code. Use environment variables. Keys are non-recoverable if lost -- generate a new one.</p>
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

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-cyan/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan">POST</span>
          <span className="font-mono text-sm">/v1/chat/completions</span>
        </div>

        <h4 className="font-bold text-sm mb-2">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 font-semibold text-text-dim">Parameter</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Type</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Required</th>
                <th className="pb-2 font-semibold text-text-dim">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">model</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Model ID (see Models table)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">messages</td>
                <td className="py-2 pr-4 text-text-dim">array</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Array of message objects</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">temperature</td>
                <td className="py-2 pr-4 text-text-dim">number</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">0-2, default 1</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">max_tokens</td>
                <td className="py-2 pr-4 text-text-dim">integer</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">Max tokens in completion</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">stream</td>
                <td className="py-2 pr-4 text-text-dim">boolean</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">Enable SSE streaming</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">tools</td>
                <td className="py-2 pr-4 text-text-dim">array</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">Function calling definitions</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-cyan">response_format</td>
                <td className="py-2 pr-4 text-text-dim">object</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">JSON mode: {'{"type": "json_object"}'}</td>
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
    base_url="https://oma-ai.com/v1",
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
  baseURL: 'https://oma-ai.com/v1',
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
            code: `curl https://oma-ai.com/v1/chat/completions \\
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

      <h4 className="font-bold text-sm mt-6 mb-3">Response Format</h4>
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

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-cyan/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan">POST</span>
          <span className="font-mono text-sm">/v1/completions</span>
        </div>

        <h4 className="font-bold text-sm mb-2">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 font-semibold text-text-dim">Parameter</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Type</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Required</th>
                <th className="pb-2 font-semibold text-text-dim">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">model</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Model ID</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">prompt</td>
                <td className="py-2 pr-4 text-text-dim">string/array</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Prompt text(s) to complete</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">max_tokens</td>
                <td className="py-2 pr-4 text-text-dim">integer</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">Max tokens (default 16)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-cyan">temperature</td>
                <td className="py-2 pr-4 text-text-dim">number</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">0-2, default 1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://oma-ai.com/v1/completions \\
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

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-green/20 px-2 py-0.5 font-mono text-xs font-bold text-green">GET</span>
          <span className="font-mono text-sm">/v1/models</span>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="List Models"
        code={`curl https://oma-ai.com/v1/models \\
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

      <h4 className="font-bold text-sm mt-6 mb-3">Available Models</h4>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-panel">
                <th className="px-4 py-3 font-semibold text-text-dim">Model</th>
                <th className="px-4 py-3 font-semibold text-text-dim">ID</th>
                <th className="px-4 py-3 font-semibold text-text-dim">Context</th>
                <th className="px-4 py-3 font-semibold text-text-dim">Input/1M</th>
                <th className="px-4 py-3 font-semibold text-text-dim">Output/1M</th>
                <th className="px-4 py-3 font-semibold text-text-dim">Provider</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id} className="border-b border-border/50 transition-colors hover:bg-surface">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{m.name}</span>
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-dim">{m.badge}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-cyan">{m.id}</td>
                  <td className="px-4 py-3 font-mono">{m.context}</td>
                  <td className="px-4 py-3 font-mono text-amber">{m.input}</td>
                  <td className="px-4 py-3 font-mono text-amber">{m.output}</td>
                  <td className="px-4 py-3 text-text-dim">{m.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-xs text-text-dim">
        <p>Prices in USD credits. OMA stakers receive up to 15% discount on inference.</p>
      </div>
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

      <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4 mb-6">
        <div className="flex items-center gap-2 font-bold text-cyan mb-1">
          <Zap className="h-4 w-4" />
          Live
        </div>
        <p className="text-text-dim text-xs">Powered by Venice AI. Text-embedding-3-small model. Flat rate: 1 credit per request.</p>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-cyan/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan">POST</span>
          <span className="font-mono text-sm">/v1/embeddings</span>
        </div>
        <h4 className="font-bold text-sm mb-2">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 font-semibold text-text-dim">Parameter</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Type</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Required</th>
                <th className="pb-2 font-semibold text-text-dim">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">input</td>
                <td className="py-2 pr-4 text-text-dim">string/array</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Text or array of texts to embed</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-cyan">model</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Embedding model ID</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://oma-ai.com/v1/embeddings \\
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

      <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4 mb-6">
        <div className="flex items-center gap-2 font-bold text-cyan mb-1">
          <Zap className="h-4 w-4" />
          Live
        </div>
        <p className="text-text-dim text-xs">Powered by Venice AI SDXL. Flat rate: 5 credits per image. Supports 1024x1024, 768x768, 512x512.</p>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-cyan/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan">POST</span>
          <span className="font-mono text-sm">/v1/images/generations</span>
        </div>
        <h4 className="font-bold text-sm mb-2">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 font-semibold text-text-dim">Parameter</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Type</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Required</th>
                <th className="pb-2 font-semibold text-text-dim">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">prompt</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Text description of desired image</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">model</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">Default: sdxl</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">n</td>
                <td className="py-2 pr-4 text-text-dim">integer</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">Number of images (1-4), default 1</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-cyan">size</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">1024x1024 (default), 512x512, 768x768</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://oma-ai.com/v1/images/generations \\
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

      <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4 mb-6">
        <div className="flex items-center gap-2 font-bold text-cyan mb-1">
          <Zap className="h-4 w-4" />
          Live
        </div>
        <p className="text-text-dim text-xs">Powered by Venice AI. OpenAI-compatible TTS. ~1 credit per 1K tokens. Returns raw audio binary.</p>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-cyan/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan">POST</span>
          <span className="font-mono text-sm">/v1/audio/speech</span>
        </div>
        <h4 className="font-bold text-sm mb-2">Request Body</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 font-semibold text-text-dim">Parameter</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Type</th>
                <th className="pb-2 pr-4 font-semibold text-text-dim">Required</th>
                <th className="pb-2 font-semibold text-text-dim">Description</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">model</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">TTS model ID</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">input</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-amber">yes</td>
                <td className="py-2 text-text-dim font-sans">Text to convert to speech</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 text-cyan">voice</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">Voice preset (alloy, echo, fable, etc.)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-cyan">response_format</td>
                <td className="py-2 pr-4 text-text-dim">string</td>
                <td className="py-2 pr-4 text-text-dim">no</td>
                <td className="py-2 text-text-dim font-sans">mp3, opus, aac, flac (default mp3)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        lang="bash"
        title="cURL"
        code={`curl https://oma-ai.com/v1/audio/speech \\
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

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <h3 className="font-bold mb-4">Deposit Methods</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">$</span>
            <div>
              <span className="font-semibold">USDC on Base</span>
              <span className="text-text-dim"> -- Instant, 1:1 credits, 0% fee. Direct transfer on Base L2.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold">$</span>
            <div>
              <span className="font-semibold">USDC on Solana</span>
              <span className="text-text-dim"> -- Instant, 1:1 credits, 0% fee. Direct transfer on Solana.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">O</span>
            <div>
              <span className="font-semibold">OMA Token</span>
              <span className="text-text-dim"> -- Instant at TWAP oracle rate, +5% bonus. Circuit breakers apply.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber/20 text-amber text-[10px] font-bold">H</span>
            <div>
              <span className="font-semibold">HoudiniSwap</span>
              <span className="text-text-dim"> -- 100+ coins (BTC, XMR, SOL, DOGE, etc.) swapped to USDC on Base. Settlement: 5-45 min.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <h3 className="font-bold mb-4">Credit System</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-text-dim">Credit value</span>
            <span className="font-mono font-bold">1:1 USD</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-text-dim">Expiry</span>
            <span className="font-mono font-bold">12-month rolling</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-text-dim">Transferable</span>
            <span className="font-mono font-bold text-pink">No</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-text-dim">Redeemable</span>
            <span className="font-mono font-bold text-pink">No</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Expected breakage</span>
            <span className="font-mono font-bold">~5-8%</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <h3 className="font-bold mb-4">Staking Discounts</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-3 py-2 font-semibold text-text-dim">Tier</th>
                <th className="px-3 py-2 font-semibold text-text-dim">OMA Staked</th>
                <th className="px-3 py-2 font-semibold text-text-dim">Discount</th>
                <th className="px-3 py-2 font-semibold text-text-dim">Rate Limit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50"><td className="px-3 py-2">None</td><td className="px-3 py-2 font-mono">0</td><td className="px-3 py-2 font-mono">0%</td><td className="px-3 py-2 font-mono">1x</td></tr>
              <tr className="border-b border-border/50"><td className="px-3 py-2">Bronze</td><td className="px-3 py-2 font-mono">1,000</td><td className="px-3 py-2 font-mono text-cyan">3%</td><td className="px-3 py-2 font-mono">1x</td></tr>
              <tr className="border-b border-border/50"><td className="px-3 py-2">Silver</td><td className="px-3 py-2 font-mono">10,000</td><td className="px-3 py-2 font-mono text-cyan">6%</td><td className="px-3 py-2 font-mono">1.5x</td></tr>
              <tr className="border-b border-border/50"><td className="px-3 py-2">Gold</td><td className="px-3 py-2 font-mono">50,000</td><td className="px-3 py-2 font-mono text-cyan">10%</td><td className="px-3 py-2 font-mono">1.5x</td></tr>
              <tr><td className="px-3 py-2">Platinum</td><td className="px-3 py-2 font-mono">100,000</td><td className="px-3 py-2 font-mono text-cyan">15%</td><td className="px-3 py-2 font-mono">2x</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-text-dim">Max combined: 20% (5% OMA bonus + 15% staking). Circuit breakers: OMA -20% = 2% bonus, -35% = 0% bonus, -50% = halt OMA deposits.</p>
      </div>

      <div className="rounded-lg border border-border bg-panel p-4 text-xs">
        <div className="flex items-center gap-2 font-bold mb-2">
          <DollarSign className="h-4 w-4 text-cyan" />
          Payment Flow
        </div>
        <div className="space-y-2 text-text-dim">
          <p><span className="text-text font-semibold">USDC Direct:</span> 1:1 credits, instant. USDC goes to treasury.</p>
          <p><span className="text-text font-semibold">OMA Token:</span> 1:1 + 5% bonus at TWAP oracle rate. 50% burned, 50% treasury.</p>
          <p><span className="text-text font-semibold">HoudiniSwap:</span> Swap to USDC on Base. Credits after settlement. HoudiniSwap cannot split to two addresses.</p>
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

      <div className="overflow-hidden rounded-xl border border-border mb-6">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-panel">
              <th className="px-4 py-3 font-semibold text-text-dim">Code</th>
              <th className="px-4 py-3 font-semibold text-text-dim">Type</th>
              <th className="px-4 py-3 font-semibold text-text-dim">Description</th>
            </tr>
          </thead>
          <tbody>
            {ERROR_CODES.map((e) => (
              <tr key={e.code} className="border-b border-border/50 transition-colors hover:bg-surface">
                <td className="px-4 py-3 font-mono font-bold text-pink">{e.code}</td>
                <td className="px-4 py-3 font-mono text-amber">{e.type}</td>
                <td className="px-4 py-3 text-text-dim">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="font-bold text-sm mb-3">Error Response Format</h4>
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

      <div className="mt-4 rounded-lg border border-border bg-panel p-4 text-xs">
        <h4 className="font-bold mb-2">Handling 429 Rate Limits</h4>
        <CodeBlock
          lang="python"
          title="Retry with Exponential Backoff"
          code={`import time
from openai import OpenAI

client = OpenAI(
    base_url="https://oma-ai.com/v1",
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

      <div className="rounded-xl border border-border bg-panel p-5 mb-6">
        <p className="text-sm text-text-dim mb-4">
          The x402 protocol enables HTTP 402 Payment Required responses with payment details.
          AI agents can automatically pay for API access using crypto wallets without API keys.
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">1</span>
            <div>
              <span className="font-semibold">Agent sends request</span>
              <span className="text-text-dim"> -- Standard HTTP request without Authorization header</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">2</span>
            <div>
              <span className="font-semibold">OMA returns 402</span>
              <span className="text-text-dim"> -- HTTP 402 with x402 payment requirements in response body</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">3</span>
            <div>
              <span className="font-semibold">Agent pays</span>
              <span className="text-text-dim"> -- Signs EIP-712 payment authorization on Base or Solana</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan/20 text-cyan text-[10px] font-bold">4</span>
            <div>
              <span className="font-semibold">Resend with proof</span>
              <span className="text-text-dim"> -- Include payment receipt in X-Payment header. OMA verifies on-chain.</span>
            </div>
          </div>
        </div>
      </div>

      <CodeBlock
        lang="typescript"
        title="x402 Client (Base)"
        code={`import { x402 } from '@x402/hono';

const response = await fetch('https://oma-ai.com/v1/chat/completions', {
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
  
  const paid = await fetch('https://oma-ai.com/v1/chat/completions', {
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

      <div className="rounded-xl border border-border bg-panel p-5 mt-6">
        <h4 className="font-bold mb-3">x402 Pricing</h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-text-dim">Read (GET /v1/models)</span>
            <span className="font-mono">$0.0001</span>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-text-dim">Quote (price check)</span>
            <span className="font-mono">$0.001</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Exchange (inference)</span>
            <span className="font-mono">Model-dependent</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-4 text-xs mt-4">
        <div className="flex items-center gap-2 font-bold text-cyan mb-1">
          <Shield className="h-4 w-4" />
          Live -- Direct HTTP Payments
        </div>
        <p className="text-text-dim">
          x402 is fully operational on Base and Solana. Send a <code className="text-cyan">PAYMENT-SIGNATURE</code>
          header with USDC transfers to pay per-request. No pre-funded account needed.
          See the <code className="text-cyan">POST /v1/x402/proxy/chat/completions</code> endpoint for agent-native payments.
        </p>
      </div>
    </div>
  )
}
