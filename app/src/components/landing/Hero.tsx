'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Code2, CreditCard, Lock, Zap, Coins, Bot, AppWindow, Workflow } from 'lucide-react'

const devCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.oma-ai.com/v1",
  apiKey: process.env.OMA_API_KEY,
});

const response = await client.chat.completions.create({
  model: "oma/auto",
  messages: [{ role: "user", content: "Build me a launch plan." }],
});`

const trustBullets = [
  { icon: Code2, text: 'OpenAI-compatible API' },
  { icon: Zap, text: 'Multi-model routing' },
  { icon: Lock, text: 'Privacy-first inference' },
  { icon: CreditCard, text: 'Pay-as-you-go pricing' },
]

const builtForItems = [
  { icon: Bot, text: 'Agents' },
  { icon: AppWindow, text: 'Apps' },
  { icon: Workflow, text: 'Automation' },
]

export function Hero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative min-h-screen pt-24 pb-16 px-6 overflow-hidden bg-[#fafafa]">
      <div className="mx-auto max-w-7xl relative z-10">
        
        {/* Hero Header */}
        <div className={`mb-12 text-center flex flex-col items-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          <h1 className="font-hanken text-4xl md:text-6xl font-bold text-[#151c27] tracking-tight mb-4 max-w-3xl leading-[1.1]">
            Open Model Access for AI builders
          </h1>
          
          <p className="max-w-2xl text-lg md:text-xl text-[#464555] leading-relaxed mb-8">
            One gateway. Every model. No lock-in.
          </p>

          <p className="sr-only">
            OpenAI-compatible inference API for builders. Route prompts across private, open, and commercial models with multi-model routing, privacy-first inference, and pay-as-you-go pricing. Built for agents, apps, and automation.
          </p>

          <div className="flex flex-wrap gap-4 items-center justify-center w-full mb-8">
            <Link href="/dashboard" className="group relative px-8 py-3.5 rounded-xl font-inter font-semibold text-white text-base overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(79,70,229,0.3)]">
              <span className="absolute inset-0 bg-gradient-to-r from-[#3525cd] to-[#4f46e5]"></span>
              <span className="absolute inset-0 bg-gradient-to-r from-[#4f46e5] to-[#00687a] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center justify-center gap-2">
                Get API Access
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
            <Link href="/docs" className="px-8 py-3.5 rounded-xl font-inter font-semibold text-[#3525cd] text-base border-2 border-[#3525cd]/20 bg-white hover:bg-white hover:border-[#3525cd]/40 hover:shadow-[0_4px_16px_rgba(79,70,229,0.1)] transition-all duration-300">
              View Docs
            </Link>
          </div>
          
          {/* Trust Bullets */}
          <div className="flex items-center justify-center gap-6 text-sm font-medium text-[#464555] flex-wrap mb-6">
            {trustBullets.map((bullet, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <bullet.icon className="w-4 h-4 text-[#3525cd]" />
                {bullet.text}
              </span>
            ))}
          </div>

          {/* Built for */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#464555]/60">Built for</span>
            <div className="flex items-center gap-2">
              {builtForItems.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-xs font-medium text-[#464555]">
                  <item.icon className="w-3 h-3 text-[#3525cd]" />
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dev Code Block */}
        <div className={`max-w-3xl mx-auto mb-16 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="rounded-2xl overflow-hidden border border-[#e5e7eb] shadow-[0_4px_30px_rgba(0,0,0,0.06)] bg-white">
            {/* Code header */}
            <div className="px-4 py-3 border-b border-[#e5e7eb] bg-[#fafafa] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                </div>
                <span className="text-xs text-[#464555] font-mono ml-2">oma-gateway.ts</span>
              </div>
              <span className="text-xs text-[#464555]/60">OpenAI SDK</span>
            </div>
            {/* Code content */}
            <pre className="p-5 overflow-x-auto bg-[#1a1c2e]">
              <code className="text-sm text-[#e0e3e5] font-mono leading-relaxed whitespace-pre">{devCode}</code>
            </pre>
          </div>
        </div>

        {/* Payment Section */}
        <div className={`max-w-3xl mx-auto mb-16 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="relative rounded-2xl p-8 bg-gradient-to-br from-[#f0f3ff] to-white border border-[#e5e7eb] overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#3525cd]/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative flex items-start gap-5">
              <div className="p-4 rounded-xl bg-white shadow-[0_4px_20px_rgba(79,70,229,0.15)]">
                <Coins className="w-6 h-6 text-[#3525cd]" />
              </div>
              <div className="flex-1">
                <h3 className="font-hanken text-xl font-semibold text-[#151c27] mb-2">Top up with crypto</h3>
                <p className="text-[#464555] leading-relaxed">
                  OMA AI supports crypto-friendly account credits using Houdini-powered payment flows.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className={`max-w-3xl mx-auto transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="relative rounded-2xl p-8 bg-white border border-[#e5e7eb] overflow-hidden">
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/4"></div>
            <div className="relative flex items-start gap-5">
              <div className="p-4 rounded-xl bg-[#f0fdf4] shadow-[0_4px_20px_rgba(34,197,94,0.15)]">
                <Lock className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-hanken text-xl font-semibold text-[#151c27] mb-2">Private by design</h3>
                <p className="text-[#464555] leading-relaxed">
                  OMA routes inference through Venice, a privacy-focused AI provider with zero data retention. OMA minimizes stored data.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
