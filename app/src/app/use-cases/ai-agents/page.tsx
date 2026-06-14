// ponytail: production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Zap, ArrowRight, Copy, Check, Brain, Shield, Globe, Cpu } from 'lucide-react'

const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://api.oma-ai.com/v1",
    api_key="oma_sk_your_key"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Research the latest AI trends"}]
)

print(response.choices[0].message.content)`

const jsCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.oma-ai.com/v1",
  apiKey: process.env.OMA_API_KEY,
});

const response = await client.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [{ role: "system", content: "You are a research agent." }, { role: "user", content: "Research latest AI trends" }],
});

console.log(response.choices[0].message.content);`

const curlCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Research the latest AI trends"}]
  }'`

const tabs = [
  { label: 'Python', code: pythonCode },
  { label: 'TypeScript', code: jsCode },
  { label: 'cURL', code: curlCode },
]

const features = [
  { icon: Brain, title: 'Autonomous Reasoning', desc: 'Chain-of-thought prompting with large context windows for complex tasks.' },
  { icon: Shield, title: 'No KYC Required', desc: 'Build agents without identity verification or account requirements.' },
  { icon: Globe, title: 'Global Infrastructure', desc: 'Venice-powered inference with global edge deployment for low-latency.' },
  { icon: Cpu, title: 'Tool Calling', desc: 'Function calling and structured outputs for multi-step workflows.' },
]

const integrations = [
  { name: 'LangChain', desc: 'LangChain agent with OpenAI-compatible provider', code: 'from langchain_openai import ChatOpenAI\nllm = ChatOpenAI(base_url="https://api.oma-ai.com/v1", model="llama-3.3-70b")' },
  { name: 'AutoGen', desc: 'Microsoft AutoGen multi-agent framework', code: 'from autogen import ConversableAgent\nagent = ConversableAgent("assistant", llm_config={"model": "llama-3.3-70b", "base_url": "https://api.oma-ai.com/v1"})' },
  { name: 'CrewAI', desc: 'CrewAI orchestrating multi-agent workflows', code: 'from crewai import Agent, Task\nagent = Agent(role="researcher", llm_base_url="https://api.oma-ai.com/v1", llm_model="llama-3.3-70b")' },
  { name: 'Custom Agents', desc: 'Build your own agent loop with x402 payments', code: 'async def agent_task():\n    async with OpenAI(base_url="https://api.oma-ai.com/v1") as client:\n        # Agent logic here' },
]

export default function AIAgentsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)

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
    <div className="min-h-[calc(100vh-4rem)] px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-2 font-mono text-sm font-semibold text-[var(--color-accent)]">
            <Brain className="h-4 w-4" aria-hidden="true" />
            AI Agents Use Case
          </div>
          <h1 className="font-syne text-4xl font-bold tracking-tight text-[var(--color-text)] sm:text-5xl">
            Power Your AI Agents with Permissionless Inference
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-text-muted)]">
            Build agents that research, reason, and act. No KYC, no accounts. Pay with crypto, deploy globally.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-8 py-4 font-syne text-sm font-semibold text-[var(--color-text-inverse)] shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:bg-[var(--color-accent-hover)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              <Zap className="h-5 w-5" aria-hidden="true" />
              Start Building Agents
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-transparent px-6 py-4 font-mono text-sm font-medium text-[var(--color-text)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              View Documentation
            </Link>
          </div>
        </div>

        <div className="mt-20">
          <h2 className="font-syne mb-8 text-2xl font-bold text-[var(--color-text)] text-center">Quick Start</h2>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] p-4">
              <div className="flex gap-1">
                {tabs.map((tab, i) => (
                  <button 
                    key={tab.label} 
                    onClick={() => setActiveTab(i)} 
                    className={`px-4 py-2 font-mono text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
                      activeTab === i 
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' 
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                    }`}
                    aria-pressed={activeTab === i}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button 
                onClick={handleCopy} 
                className="flex items-center gap-1.5 font-mono text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
              >
                {copied ? <><Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" /> Copied</> : <><Copy className="h-4 w-4" aria-hidden="true" /> Copy</>}
              </button>
            </div>
            <div className="p-6">
              <pre className="overflow-x-auto font-mono text-sm text-[var(--color-accent)] whitespace-pre" aria-live="polite">{tabs[activeTab].code}</pre>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="font-syne mb-8 text-2xl font-bold text-[var(--color-text)] text-center">Features</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all hover:border-[var(--color-accent)]/30">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  <f.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-syne text-lg font-semibold text-[var(--color-text)]">{f.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="font-syne mb-8 text-2xl font-bold text-[var(--color-text)] text-center">Integration Examples</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {integrations.map((intg) => (
              <div key={intg.name} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="p-6 border-b border-[var(--color-border)]">
                  <h3 className="font-syne font-semibold text-[var(--color-text)]">{intg.name}</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{intg.desc}</p>
                </div>
                <div className="bg-[var(--color-panel)] p-4">
                  <pre className="overflow-x-auto font-mono text-xs text-[var(--color-accent)] whitespace-pre-wrap">{intg.code}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 text-center">
          <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-r from-[var(--color-accent)]/5 to-[var(--color-tertiary)]/5 p-8">
            <h2 className="font-syne text-2xl font-bold text-[var(--color-text)]">Ready to Build Agents?</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">Get your API key and start building autonomous AI agents today.</p>
            <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-8 py-4 font-mono text-sm font-semibold text-[var(--color-text-inverse)] transition-all hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              Get API Key <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
