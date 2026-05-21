'use client'

import Link from 'next/link'
import { ArrowLeft, Shield, Eye, Database, Lock, Info, CreditCard } from 'lucide-react'

export default function PrivacyPage() {
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
            <Shield className="h-6 w-6 text-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PRIVACY POLICY</h1>
            <p className="mono mt-1 text-xs text-text-dim">
              LAST UPDATED: 2026-01-01 | STATUS: ACTIVE
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-cyan/20 bg-cyan/5 p-4">
          <Lock className="h-5 w-5 shrink-0 text-cyan" />
          <div className="text-xs text-text-dim">
            <span className="font-bold text-cyan">YOUR PRIVACY MATTERS:</span> OMA AI is built on a philosophy of
            minimal data collection. We do not track, store, or sell your personal information. All inference
            requests are processed without logging content.
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <Database className="h-4 w-4" />
            1. DATA WE COLLECT
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>We collect minimal information necessary to provide the service:</p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">Wallet Address:</span> Used for authentication (EVM or Solana via SIWE)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">API Usage:</span> Token counts and timestamps for billing purposes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">Transaction Hashes:</span> For deposit verification on-chain</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">API Keys:</span> Hashed for authentication, prefixed for identification</span>
              </li>
            </ul>
            <p className="mt-4">
              We do <span className="font-bold text-pink">NOT</span> collect, store, or log the content of your
              API requests. Inference is processed in memory and no prompt or completion data is persisted.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <Eye className="h-4 w-4" />
            2. WALLET INFORMATION
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>
              Authentication is performed via Sign-In With Ethereum (SIWE) or Solana signatures. Your wallet
              address is used to:
            </p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Authenticate API requests</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Associate usage with your account for billing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Link deposits for credit allocation</span>
              </li>
            </ul>
            <p className="mt-4">
              Your wallet address is stored but <span className="font-bold text-amber">we do not track wallet activity</span>.
              We cannot see your token balances, NFTs, or transaction history on-chain.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <CreditCard className="h-4 w-4" />
            3. API LOGS & BILLING
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>
              For billing purposes, we record:
            </p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Model ID used (e.g., &quot;gpt-4o&quot;)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Token counts (prompt and completion)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Cost in cents for the request</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Timestamp of request</span>
              </li>
            </ul>
            <p className="mt-4">
              <span className="font-bold text-text">We do NOT log:</span> The actual prompt text, completion text,
              or any content that passes through the model. Your prompts and responses are never stored.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <Lock className="h-4 w-4" />
            4. DATA RETENTION
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span><span className="font-bold text-text">API Logs:</span> Retained for 90 days for usage reporting</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span><span className="font-bold text-text">Account Data:</span> Retained until account deletion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span><span className="font-bold text-text">Credits:</span> Non-redeemable, expire after 12 months</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span><span className="font-bold text-text">API Keys:</span> Revoked immediately upon deletion</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <Shield className="h-4 w-4" />
            5. THIRD PARTIES
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>We share minimal data with trusted service providers:</p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">Venice AI:</span> Inference requests are routed for processing (content not logged)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">AntSeed P2P:</span> Peer-to-peer inference routing (no content logging)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">HoudiniSwap:</span> Crypto swap service, operates independently</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span><span className="font-bold text-text">Base Blockchain:</span> Transaction verification on-chain</span>
              </li>
            </ul>
            <p className="mt-4">
              We do not sell, rent, or share any personal data with advertisers or analytics services.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-cyan">
            <Shield className="h-4 w-4" />
            6. YOUR RIGHTS
          </div>
          <div className="space-y-3 text-xs text-text-dim">
            <p>You have the right to:</p>
            <ul className="ml-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Delete your account and all associated data at any time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Export your usage history and account data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Revoke API keys independently</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span>Unlink wallet addresses from your account</span>
              </li>
            </ul>
            <p className="mt-4">
              Contact us at <span className="text-cyan">privacy@oma-ai.com</span> to exercise any of these rights.
            </p>
          </div>
        </div>

        <div className="card border-text-dim/20">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-text-dim">
            <Info className="h-4 w-4" />
            CONTACT
          </div>
          <div className="text-xs text-text-dim">
            For privacy-related inquiries, contact our data team at{' '}
            <span className="text-cyan">privacy@oma-ai.com</span>
          </div>
        </div>
      </div>
    </div>
  )
}