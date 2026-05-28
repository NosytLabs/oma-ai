'use client'

import Link from 'next/link'
import { ArrowLeft, FileText, Scale, AlertTriangle, Info } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-void)] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-xs font-mono text-text-muted transition-colors hover:text-cyan"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK TO HOME
          </Link>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10">
              <Scale className="h-6 w-6 text-[var(--color-cyan)]" />
            </div>
            <div>
              <h1 className="font-syne text-2xl font-bold tracking-tight text-text">TERMS OF SERVICE</h1>
              <p className="font-mono mt-1 text-xs text-text-muted">
                LAST UPDATED: 2026-01-01 | STATUS: ACTIVE
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-[var(--color-amber)]/20 bg-[var(--color-amber)]/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-amber)] mt-0.5" />
            <div className="text-sm text-text-muted">
              <span className="font-bold text-[var(--color-amber)]">IMPORTANT:</span> By using OMA AI services, {"you're"} agreeing
              to these Terms. If you {"don't"} agree, {"don't"} use the service.
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <FileText className="h-4 w-4" />
              1. API USAGE
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>
The OMA AI API gives you access to text generation, chat, embeddings, and image generation. By using the API, you agree to:
              </p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Use the API only for lawful purposes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>{"Don't"} exceed rate limits or abuse the service</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>{"Don't"} resell or redistribute API access without written permission</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Keep your API keys secure. {"You're"} responsible for everything that happens under your account.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <FileText className="h-4 w-4" />
              2. ACCEPTABLE USE
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>{"Don't"} use OMA AI services for:</p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>Anything illegal, harmful, or malicious</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>Generating offensive or defamatory content</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>Automated spam or mass text generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>Training competing AI models without permission</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>Probing or attacking our infrastructure</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <FileText className="h-4 w-4" />
              3. LIMITATIONS OF LIABILITY
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>
                OMA AI provides services &quot;AS IS&quot;. We do not guarantee:
              </p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber)]" />
                  <span>Uptime or availability</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber)]" />
                  <span>Accuracy or fitness of AI outputs</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber)]" />
                  <span>Error-free service</span>
                </li>
              </ul>
              <p className="mt-6">
                We {"aren't"} liable for any indirect, incidental, special, or consequential damages from using the service. That includes lost profits, data, or whatever else comes up.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <FileText className="h-4 w-4" />
              4. CREDIT SYSTEM
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Credits are non-redeemable, non-transferable, and have a 12-month rolling expiry</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Credits are consumed per token processed and are deducted in real-time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>OMA token deposits include a 5% bonus subject to circuit breaker conditions</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Staking discounts apply to inference costs only and cannot exceed 20% combined</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <FileText className="h-4 w-4" />
              5. ACCOUNT TERMINATION
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>
                We can suspend or terminate accounts that violate these Terms, abuse the service, or pose a risk to our infrastructure or users. When that happens:
              </p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>All credits are forfeited</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>API keys get revoked immediately</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pink)]" />
                  <span>Staked OMA is returned after cooldown period</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-panel/50 p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-text-muted">
              <Info className="h-4 w-4" />
              CONTACT
            </div>
            <div className="text-sm text-text-muted">
              For questions about these Terms, contact us at{' '}
              <span className="text-[var(--color-cyan)]">legal@oma-ai.com</span> or via our Discord community.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}