'use client'

import Link from 'next/link'
import { ArrowLeft, Shield, Eye, Database, Lock, CreditCard } from 'lucide-react'

export default function PrivacyPage() {
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
              <Shield className="h-6 w-6 text-[var(--color-cyan)]" />
            </div>
            <div>
              <h1 className="font-syne text-2xl font-bold tracking-tight text-text">PRIVACY POLICY</h1>
              <p className="font-mono mt-1 text-xs text-text-muted">
                LAST UPDATED: 2026-01-01 | STATUS: ACTIVE
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/5 p-5">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 shrink-0 text-[var(--color-cyan)] mt-0.5" />
            <div className="text-sm text-text-muted">
              <span className="font-bold text-[var(--color-cyan)]">YOUR PRIVACY MATTERS:</span> OMA AI is built on a philosophy of
              minimal data collection. We do not track, store, or sell your personal information. All inference
              requests are processed without logging content.
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <Database className="h-4 w-4" />
              1. DATA WE COLLECT
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>We collect minimal information necessary to provide the service:</p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">Wallet Address:</span> Used for authentication (EVM or Solana via SIWE)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">API Usage:</span> Token counts and timestamps for billing purposes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">Transaction Hashes:</span> For deposit verification on-chain</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">API Keys:</span> Hashed for authentication, prefixed for identification</span>
                </li>
              </ul>
              <p className="mt-4">
                We do <span className="font-bold text-[var(--color-pink)]">NOT</span> collect, store, or log the content of your
                API requests. Inference is processed in memory and no prompt or completion data is persisted.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <Eye className="h-4 w-4" />
              2. WALLET INFORMATION
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>
                Authentication is performed via Sign-In With Ethereum (SIWE) or Solana signatures. Your wallet
                address is used to:
              </p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Authenticate API requests</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Associate usage with your account for billing</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Link deposits for credit allocation</span>
                </li>
              </ul>
              <p className="mt-4">
                Your wallet address is stored but <span className="font-bold text-[var(--color-amber)]">we do not track wallet activity</span>.
                We cannot see your token balances, NFTs, or transaction history on-chain.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <CreditCard className="h-4 w-4" />
              3. API LOGS & BILLING
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>For billing purposes, we record:</p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Model ID used (e.g., {"\"gpt-4o\""})</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Token counts (prompt and completion)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Cost in cents for the request</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Timestamp of request</span>
                </li>
              </ul>
              <p className="mt-4">
                <span className="font-bold text-text">We do NOT log:</span> The actual prompt text, completion text,
                or any content that passes through the model. Your prompts and responses are never stored.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <Lock className="h-4 w-4" />
              4. DATA RETENTION
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber)]" />
                  <span><span className="font-bold text-text">API Logs:</span> Retained for 90 days for usage reporting</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber)]" />
                  <span><span className="font-bold text-text">Account Data:</span> Retained until account deletion</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber)]" />
                  <span><span className="font-bold text-text">Credits:</span> Non-redeemable, expire after 12 months</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber)]" />
                  <span><span className="font-bold text-text">API Keys:</span> Revoked immediately upon deletion</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <Shield className="h-4 w-4" />
              5. THIRD PARTIES
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>We share minimal data with trusted service providers:</p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">Venice AI:</span> Inference requests are routed for processing (content not logged)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">AntSeed P2P:</span> Peer-to-peer inference routing (no content logging)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">HoudiniSwap:</span> Crypto swap service, operates independently</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span><span className="font-bold text-text">Base Blockchain:</span> Transaction verification on-chain</span>
                </li>
              </ul>
              <p className="mt-4">
                We do not sell, rent, or share any personal data with advertisers or analytics services.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold text-[var(--color-cyan)]">
              <Shield className="h-4 w-4" />
              6. YOUR RIGHTS
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <p>You have the right to:</p>
              <ul className="ml-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Request deletion of your account data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Revoke API keys at any time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Export your usage data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>Contact us regarding any privacy concerns</span>
                </li>
              </ul>
              <p className="mt-4">
                For privacy-related inquiries, reach out to <span className="text-[var(--color-cyan)]">privacy@oma-ai.com</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}