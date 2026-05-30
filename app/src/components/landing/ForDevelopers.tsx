'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Zap, Key, Coins, Activity, ArrowRight, Copy, Check } from 'lucide-react'

const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://api.oma-ai.com/v1",
    api_key="oma_sk_your_key"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)`

const jsCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.oma-ai.com/v1",
  apiKey: "oma_sk_your_key",
});

const response = await client.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [{ role: "user", content: "Hello" }],
});`

const curlCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'`

const tabs = [
  { label: 'Python', code: pythonCode },
  { label: 'TypeScript', code: jsCode },
  { label: 'cURL', code: curlCode },
]

const features = [
  { icon: Zap, title: 'OpenAI-Compatible', desc: 'Use any OpenAI SDK. Just change the base URL.', color: 'text-[var(--color-cyan)]' },
  { icon: Key, title: 'Bearer Token Auth', desc: 'SHA-256 hashed keys. Your inference, your key.', color: 'text-[var(--color-cyan)]' },
  { icon: Coins, title: 'x402 Payments', desc: 'Agent-native payments via HTTP 402.', color: 'text-[var(--color-secondary)]' },
  { icon: Activity, title: 'Streaming & Tools', desc: 'Real-time streaming. Function calling.', color: 'text-[var(--color-success)]' },
]

export function ForDevelopers() {
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tabs[activeTab].code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-[var(--color-void)]" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-4xl md:text-5xl font-syne font-bold tracking-tight text-[var(--color-text)] mb-4">
            Built for Developers
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
            Drop-in replacement for OpenAI. Change one line, keep your code.
          </p>
        </div>

        <div className={`mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
          <div className="flex items-center justify-between border-b border-[var(--color-border)] mb-0">
            <div className="flex gap-1">
              {tabs.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(i)}
                  className={`px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 cursor-pointer ${
                    activeTab === i
                      ? 'text-[var(--color-cyan)] border-[var(--color-cyan)]'
                      : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy code'}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-cyan)] hover:bg-[var(--color-surface)] rounded-lg transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          
          <div className="rounded-b-lg overflow-hidden bg-[var(--color-void)] border border-t-0 border-[var(--color-border)]">
            <pre className="p-6 overflow-x-auto">
              <code className="text-sm text-[var(--color-text-secondary)] font-mono leading-relaxed">
                {tabs[activeTab].code}
              </code>
            </pre>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className={`flex items-start gap-4 p-5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-500 hover:border-[var(--color-cyan)]/30 hover:bg-[var(--color-surface-elevated)] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${300 + i * 80}ms` }}
              >
                <Icon className={`w-5 h-5 ${f.color} mt-0.5`} />
                <div>
                  <p className="font-semibold text-[var(--color-text)] mb-1">{f.title}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{f.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className={`mt-12 flex flex-wrap justify-center gap-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '700ms' }}>
          <Link
            href="/dashboard"
            className="btn-primary text-lg px-8 py-4"
          >
            <Key className="w-5 h-5 mr-2" />
            Start Building
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
          <Link
            href="/playground"
            className="btn-secondary text-lg px-8 py-4"
          >
            <Activity className="w-5 h-5 mr-2" />
            Try Playground
          </Link>
          <Link
            href="/docs"
            className="px-6 py-4 text-base font-medium text-[var(--color-text-muted)] hover:text-[var(--color-cyan)] transition-colors"
          >
            View Docs
            <ArrowRight className="w-4 h-4 ml-2 inline-block" />
          </Link>
        </div>
      </div>
    </section>
  )
}