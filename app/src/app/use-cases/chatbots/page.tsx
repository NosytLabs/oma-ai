'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Zap, ArrowRight, Copy, Check, Bot, Users, Layers, Webhook } from 'lucide-react'

const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://api.oma-ai.com/v1",
    api_key="oma_sk_your_key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful customer support chatbot."},
        {"role": "user", "content": "I need help with my order"}
    ],
    stream=False
)

print(response.choices[0].message.content)`

const jsCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.oma-ai.com/v1",
  apiKey: process.env.OMA_API_KEY,
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are a helpful customer support chatbot." },
    { role: "user", content: "I need help with my order" },
  ],
});

console.log(response.choices[0].message.content);`

const curlCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "You are a helpful customer support chatbot."},
      {"role": "user", "content": "I need help with my order"}
    ]
  }'`

const tabs = [
  { label: 'Python', code: pythonCode },
  { label: 'TypeScript', code: jsCode },
  { label: 'cURL', code: curlCode },
]

const features = [
  { icon: MessageSquare, title: 'Conversational AI', desc: 'Natural language understanding with context windows up to 1M tokens for long conversations.' },
  { icon: Users, title: 'Multi-Tenant Support', desc: 'Deploy isolated chatbot instances per customer with secure API key management.' },
  { icon: Layers, title: 'Streaming Responses', desc: 'Real-time token streaming for human-like typing effects in chat interfaces.' },
  { icon: Webhook, title: 'Webhooks & Events', desc: 'Connect to CRMs, helpdesks, and databases via function calling and webhooks.' },
]

const integrations = [
  { name: 'Intercom', desc: 'Add AI-powered support to your Intercom inbox', code: 'from langchain_openai import ChatOpenAI\nllm = ChatOpenAI(base_url="https://api.oma-ai.com/v1", model="gpt-4o")' },
  { name: 'Zendesk', desc: 'Automate ticket responses with AI', code: 'from openai import OpenAI\nclient = OpenAI(base_url="https://api.oma-ai.com/v1")' },
  { name: 'Discord', desc: 'Build AI Discord bots with slash commands', code: 'import discord\nfrom openai import OpenAI\nclient = OpenAI(base_url="https://api.oma-ai.com/v1")' },
  { name: 'WhatsApp', desc: 'AI-powered WhatsApp business messages', code: 'from twilio.rest import Client\nclient = Client("ACxxxxxx", "your_auth_token")' },
]

export default function ChatbotsPage() {
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
            <Bot className="h-4 w-4" aria-hidden="true" />
            Chatbots Use Case
          </div>
          <h1 className="font-syne text-4xl font-bold tracking-tight text-[var(--color-text)] sm:text-5xl">
            Build Smart Chatbots with OpenAI-Compatible API
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-text-muted)]">
            Create conversational AI experiences for customer support, sales, and engagement. Pay with crypto, low-friction access.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-semibold text-[var(--color-text-inverse)] shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:bg-[var(--color-accent-hover)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              <Zap className="h-5 w-5" aria-hidden="true" />
              Start Building Chatbots
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-transparent px-6 py-4 font-mono text-sm font-medium text-[var(--color-text)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              View Documentation
            </Link>
          </div>
        </div>

        <div className="mt-20">
          <h2 className="font-syne text-2xl font-bold text-[var(--color-text)] mb-8 text-center">Quick Start</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] p-4">
              <div className="flex gap-1">
                {tabs.map((tab, i) => (
                  <button 
                    key={tab.label} 
                    onClick={() => setActiveTab(i)} 
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
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
                className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
              >
                {copied ? <><Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" /> Copied</> : <><Copy className="h-4 w-4" aria-hidden="true" /> Copy</>}
              </button>
            </div>
            <div className="bg-[var(--color-panel)] p-6 overflow-x-auto">
              <pre className="text-sm text-[var(--color-accent)] font-mono whitespace-pre" aria-live="polite">{tabs[activeTab].code}</pre>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="font-syne text-2xl font-bold text-[var(--color-text)] mb-8 text-center">Features</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] mb-4">
                  <f.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-syne text-lg font-semibold text-[var(--color-text)]">{f.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="font-syne text-2xl font-bold text-[var(--color-text)] mb-8 text-center">Integration Examples</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {integrations.map((intg) => (
              <div key={intg.name} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[var(--color-border)]">
                  <h3 className="font-syne font-semibold text-[var(--color-text)]">{intg.name}</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{intg.desc}</p>
                </div>
                <div className="bg-[var(--color-panel)] p-4">
                  <pre className="text-xs text-[var(--color-accent)] font-mono whitespace-pre-wrap">{intg.code}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 text-center">
          <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-r from-[var(--color-accent)]/5 to-[var(--color-tertiary)]/5 p-8">
            <h2 className="font-syne text-2xl font-bold text-[var(--color-text)]">Ready to Build Your Chatbot?</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">Get your API key and start creating conversational AI experiences today.</p>
            <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-semibold text-[var(--color-text-inverse)] transition-all hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              Get API Key <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
