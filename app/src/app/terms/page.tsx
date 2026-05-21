'use client'

import Link from 'next/link'
import { ArrowLeft, FileText, Scale, AlertTriangle, Info } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 font-mono">
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-xs text-text-dim transition-colors hover:text-cyan"
        >
          <ArrowLeft className="h-3 w-3" />
          BACK TO HOME
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10">
            <Scale className="h-6 w-6 text-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TERMS OF SERVICE</h1>
            <p className="mono mt-1 text-xs text-text-dim">
              LAST UPDATED: 2026-01-01 | STATUS: ACTIVE
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber/20 bg-amber/5 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber" />
          <div className="text-xs text-text-dim">
            <span className="font-bold text-amber">IMPORTANT:</span> By using OMA AI services, you acknowledge
            that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree
            to these terms, do not use this service.
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <FileText className="h-4 w-4" />
            1. API USAGE
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>
              The OMA AI API provides access to AI inference services including text generation, chat completion,
              embeddings, and image generation. By using our API, you agree to:
            </p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Use the API only for lawful purposes and in accordance with these Terms</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Not exceed rate limits or engage in abuse of the service</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Not resell, redistribute, or sublicense access to the API without written permission</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Maintain the security of your API keys and accept responsibility for all activity under your account</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <FileText className="h-4 w-4" />
            2. ACCEPTABLE USE
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>You agree NOT to use OMA AI services for:</p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>Any illegal, harmful, or malicious purpose</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>Generation of content that is offensive, defamatory, or violates rights</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>Automated mass text generation or spam</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>Training of competing AI models without explicit permission</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>Attacking, probing, or scanning vulnerability of the infrastructure</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <FileText className="h-4 w-4" />
            3. LIMITATIONS OF LIABILITY
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>
              OMA AI provides services &quot;AS IS&quot; without warranties of any kind. We do not guarantee:
            </p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span>Uptime or availability of the service</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span>Accuracy, completeness, or fitness for a particular purpose of AI outputs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span>Error-free or uninterrupted service</span>
              </li>
            </ul>
            <p className="mt-4">
              In no event shall OMA AI be liable for any indirect, incidental, special, consequential, or punitive
              damages, including without limitation, loss of profits, data, or use, arising out of or relating to
              your use of the service.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <FileText className="h-4 w-4" />
            4. CREDIT SYSTEM
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Credits are non-redeemable, non-transferable, and have a 12-month rolling expiry</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Credits are consumed per token processed and are deducted in real-time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>OMA token deposits include a 5% bonus subject to circuit breaker conditions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Staking discounts apply to inference costs only and cannot exceed 20% combined</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <FileText className="h-4 w-4" />
            5. ACCOUNT TERMINATION
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms, engage in abuse,
              or pose a risk to our infrastructure or users. Upon termination:
            </p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>All credits are forfeited and non-redeemable</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>API keys are immediately revoked</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink" />
                <span>Staked OMA is returned after cooldown period</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="card border-text-dim/20">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-text-dim">
            <Info className="h-4 w-4" />
            CONTACT
          </div>
          <div className="text-xs text-text-dim">
            For questions about these Terms, contact us at{' '}
            <span className="text-cyan">legal@oma-ai.com</span> or via our Discord community.
          </div>
        </div>
      </div>
    </div>
  )
}