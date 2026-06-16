'use client'

import { Globe, Search, Download, Shield, Users, Clock, Mail, Zap } from 'lucide-react'

export function TinyFishPricing() {
  return (
    <div className="mt-12 rounded-lg border border-success/20 bg-surface p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">OMA Web Agent Services</h3>
          <p className="text-sm text-text-muted">Powered by TinyFish. Web automation, search, and content extraction — through OMA</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-accent" />
              <span className="text-sm text-text-secondary">Web Search API</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded">FREE</span>
              <span className="text-xs text-text-muted">30 req/min</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-accent" />
              <span className="text-sm text-text-secondary">Content Fetch API</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded">FREE</span>
              <span className="text-xs text-text-muted">150 URLs/min</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-secondary" />
              <span className="text-sm text-text-secondary">Browser/Agent API</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded">$0.015/credit</span>
              <span className="text-xs text-text-muted">15-min sessions</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-secondary" />
              <span className="text-sm text-text-secondary">Concurrent Agents</span>
            </div>
            <span className="text-xs text-text-muted">2 included</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-sm text-text-secondary">Anti-Bot Protection</span>
            </div>
            <span className="text-xs font-medium text-success">Auto-configured</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-text-secondary">Stealth Browser</span>
            <span className="text-xs text-success">Included</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-text-secondary">Proxy Support</span>
            <span className="text-xs text-success">Included</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-text-muted" />
              <span className="text-sm text-text-secondary">Run History</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">30 days</span>
              <Mail className="h-4 w-4 text-text-muted" />
              <span className="text-xs text-text-muted">Email support</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-surface p-4 border border-border">
        <p className="text-xs text-text-muted">
          Agent runs include stealth browser and proxy — not metered per credit. 
          Perfect for web scraping, automated research, and complex browsing tasks.
        </p>
      </div>
    </div>
  )
}