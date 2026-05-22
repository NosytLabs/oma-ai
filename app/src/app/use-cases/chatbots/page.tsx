'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Zap, ArrowRight, Copy, Check, Bot, Users, Layers, Webhook } from 'lucide-react'

const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://oma-ai.com/v1",
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
  baseURL: "https://oma-ai.com/v1",
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

const curlCode = `curl https://oma-ai.com/v1/chat/completions \\
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
  { icon: <MessageSquare className="h-5 w-5" />, title: 'Conversational AI', desc: 'Natural language understanding with context windows up to 1M tokens for long conversations.' },
  { icon: <Users className="h-5 w-5" />, title: 'Multi-Tenant Support', desc: 'Deploy isolated chatbot instances per customer with secure API key management.' },
  { icon: <Layers className="h-5 w-5" />, title: 'Streaming Responses', desc: 'Real-time token streaming for human-like typing effects in chat interfaces.' },
  { icon: <Webhook className="h-5 w-5" />, title: 'Webhooks & Events', desc: 'Connect to CRMs, helpdesks, and databases via function calling and webhooks.' },
]

const integrations = [
  { name: 'Intercom', desc: 'Add AI-powered support to your Intercom inbox', code: 'from langchain_openai import ChatOpenAI\nllm = ChatOpenAI(base_url="https://oma-ai.com/v1", model="gpt-4o")' },
  { name: 'Zendesk', desc: 'Automate ticket responses with AI', code: 'from openai import OpenAI\nclient = OpenAI(base_url="https://oma-ai.com/v1")' },
  { name: 'Discord', desc: 'Build AI Discord bots with slash commands', code: 'import discord\nfrom openai import OpenAI\nclient = OpenAI(base_url="https://oma-ai.com/v1")' },
  { name: 'WhatsApp', desc: 'AI-powered WhatsApp business messages', code: 'from twilio imports WhatsApp\nclient = OpenAI(base_url="https://oma-ai.com/v1")' },
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
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 mb-6">
            <Bot className="h-4 w-4" />
            Chatbots Use Case
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Build Smart Chatbots with OpenAI-Compatible API
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            Create conversational AI experiences for customer support, sales, and engagement. Pay with crypto, no KYC required.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700">
              <Zap className="h-5 w-5" />
              Start Building Chatbots
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-600">
              View Documentation
            </Link>
          </div>
        </div>

        <div className="mt-20">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-8 text-center">Quick Start</h2>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex gap-1">
                {tabs.map((tab, i) => (
                  <button key={tab.label} onClick={() => setActiveTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === i ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={handleCopy} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                {copied ? <><Check className="h-4 w-4 text-green" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
              </button>
            </div>
            <div className="bg-slate-900 p-6 overflow-x-auto">
              <pre className="text-sm text-green-400 font-mono whitespace-pre">{tabs[activeTab].code}</pre>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-8 text-center">Features</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-8 text-center">Integration Examples</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {integrations.map((intg) => (
              <div key={intg.name} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">{intg.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{intg.desc}</p>
                </div>
                <div className="bg-slate-900 p-4">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{intg.code}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 text-center">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-8">
            <h2 className="text-2xl font-bold text-slate-900">Ready to Build Your Chatbot?</h2>
            <p className="mt-3 text-slate-600">Get your API key and start creating conversational AI experiences today.</p>
            <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-indigo-700">
              Get API Key <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}