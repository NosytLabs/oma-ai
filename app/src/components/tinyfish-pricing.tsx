'use client'

import { Globe, Search, Download, Shield, Users, Clock, Mail, Zap } from 'lucide-react'

export function TinyFishPricing() {
  return (
    <div className="mt-12 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-zinc-900/50 p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">TinyFish Web Agent Services</h3>
          <p className="text-sm text-zinc-500">Powerful web automation, search, and content extraction — resold through OMA</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-zinc-300">Web Search API</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">FREE</span>
              <span className="text-xs text-zinc-500">30 req/min</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-zinc-300">Content Fetch API</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">FREE</span>
              <span className="text-xs text-zinc-500">150 URLs/min</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-400" />
              <span className="text-sm text-zinc-300">Browser/Agent API</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded">$0.015/credit</span>
              <span className="text-xs text-zinc-500">15-min sessions</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-400" />
              <span className="text-sm text-zinc-300">Concurrent Agents</span>
            </div>
            <span className="text-xs text-zinc-500">2 included</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-zinc-300">Anti-Bot Protection</span>
            </div>
            <span className="text-xs font-medium text-emerald-400">Auto-configured</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <span className="text-sm text-zinc-300">Stealth Browser</span>
            <span className="text-xs text-emerald-400">Included</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <span className="text-sm text-zinc-300">Proxy Support</span>
            <span className="text-xs text-emerald-400">Included</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500" />
              <span className="text-sm text-zinc-300">Run History</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">30 days</span>
              <Mail className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Email support</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-zinc-900/50 p-4 border border-zinc-800/30">
        <p className="text-xs text-zinc-500">
          Agent runs include stealth browser and proxy — not metered per credit. 
          Perfect for web scraping, automated research, and complex browsing tasks.
        </p>
      </div>
    </div>
  )
}