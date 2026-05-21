'use client'

import { useState } from 'react'
import { useAnimatedSection } from '@/lib/hooks'
import Link from 'next/link'
import { Zap, Key, Coins, Activity, Code2, ArrowRight, Copy, Check } from 'lucide-react'
import { TerminalBlock } from './Terminal'

const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://oma-ai.com/v1",
    api_key="oma_sk_your_key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)`

const jsCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://oma-ai.com/v1",
  apiKey: "oma_sk_your_key",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(response.choices[0].message.content);`

const curlCode = `curl https://oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`

const tabs = [
  { label: 'Python', code: pythonCode, filename: 'main.py' },
  { label: 'TypeScript', code: jsCode, filename: 'index.ts' },
  { label: 'cURL', code: curlCode, filename: 'terminal' },
]

const features = [
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'OpenAI-Compatible',
    desc: 'Works with VS Code Copilot, Cursor, LangChain, any OpenAI SDK.',
    color: 'text-cyan',
  },
  {
    icon: <Key className="h-4 w-4" />,
    title: 'Bearer Token Auth',
    desc: 'SHA-256 hashed on our end. Your key, your inference.',
    color: 'text-cyan',
  },
  {
    icon: <Coins className="h-4 w-4" />,
    title: 'x402 Agent Payments',
    desc: 'Agent-native payments via HTTP 402. Built for autonomous workflows.',
    color: 'text-amber',
  },
  {
    icon: <Activity className="h-4 w-4" />,
    title: 'Streaming & Tool Use',
    desc: 'Real-time streaming responses. Function calling. Structured outputs.',
    color: 'text-green',
  },
]

export function ForDevelopers() {
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const { ref, isVisible } = useAnimatedSection()

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
    <section ref={ref} className="border-t border-border py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-4">
        <h2
          className={`mb-4 text-center text-2xl font-bold tracking-tight transition-all duration-500 sm:text-3xl ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          FOR DEVELOPERS
        </h2>
        <p
          className={`mb-12 text-center text-sm text-text-dim transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          Drop-in replacement. Change the base URL, keep your code.
        </p>

        <div
          className={`transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          {/* Tab Headers */}
          <div className="flex items-center justify-between border-b border-border">
            <div className="flex">
              {tabs.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(i)}
                  className={`group relative px-5 py-3 text-xs font-medium transition-all duration-200 ${
                    activeTab === i
                      ? 'text-cyan'
                      : 'text-text-dim hover:text-text'
                  }`}
                >
                  <Code2 className="mr-1.5 inline h-3.5 w-3.5" />
                  {tab.label}
                  {activeTab === i && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={handleCopy}
              className="mr-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-dim transition-all duration-200 hover:bg-surface hover:text-text min-h-[36px]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green" />
                  <span className="text-green">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <TerminalBlock
            code={tabs[activeTab].code}
            filename={tabs[activeTab].filename}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`card-glow flex items-start gap-4 rounded-xl border border-border bg-panel p-5 transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${300 + i * 80}ms` }}
            >
              <div className={`mt-0.5 ${f.color}`}>{f.icon}</div>
              <div>
                <p className="text-sm font-bold text-text">{f.title}</p>
                <p className="mt-1 text-xs text-text-dim">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`mt-10 flex flex-col items-center gap-4 transition-all duration-500 sm:flex-row sm:justify-center ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '700ms' }}
        >
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center gap-2 rounded-xl border border-cyan/50 bg-cyan/10 px-7 py-4 text-sm font-bold text-cyan transition-all duration-300 hover:border-cyan hover:bg-cyan hover:text-void hover:shadow-[0_0_30px_rgba(0,255,200,0.25)] hover:scale-105 active:scale-100 min-h-[52px] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 group-hover:animate-pulse" />
            <Key className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Start Building
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/playground"
            className="group inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-4 text-sm font-semibold text-text transition-all duration-300 hover:border-cyan/50 hover:bg-cyan/10 hover:text-cyan min-h-[52px]"
          >
            <Activity className="h-5 w-5" />
            Try Playground
          </Link>
          <Link
            href="/docs"
            className="btn-secondary inline-flex items-center gap-2 px-6 py-3.5 text-sm font-mono min-h-[48px]"
          >
            View Full Documentation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}