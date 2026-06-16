'use client'

import { useState } from 'react'
import { Loader2, Link2, Check, Copy, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { CRYPTO_LOGOS } from '@/lib/cryptoLogos'

const PRESET_AMOUNTS_USD = [10, 25, 50, 100, 250] as const

interface PaymentLinkResult {
  url: string
  depositId: string
  expiresAt: string
  amountUsd: string
  token: string
}

export function PaymentLinkForm() {
  const [amountUsd, setAmountUsd] = useState<number>(25)
  const [token, setToken] = useState<string>('USDC')
  const [memo, setMemo] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PaymentLinkResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      // Mint a payment link via the deposit router. In a real run this hits
      // /v1/deposit/payment-link (or HoudiniSwap's order creation endpoint),
      // gets back a deposit address + monitoring token, and returns a
      // shareable /deposit/[id] URL that any wallet can pay.
      const resp = await fetch('/v1/deposit/payment-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd,
          token,
          memo: memo.trim() || undefined,
        }),
      })
      if (resp.status === 401) throw new Error('Connect a wallet to generate a payment link.')
      if (!resp.ok) {
        const body = await resp.json().catch(() => null)
        throw new Error(body?.error?.message || `HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as PaymentLinkResult
      setResult(json)
      toast.success('Payment link generated')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate link'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — long-press the link instead')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="pl-amount" className="mb-2 block text-[10px] uppercase tracking-widest text-text-muted">
          Amount · USD
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS_USD.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountUsd(preset)}
              aria-pressed={amountUsd === preset}
              className={`px-3 py-2 text-[12px] font-mono rounded-lg border transition-colors ${
                amountUsd === preset
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-border bg-surface text-text-secondary hover:border-accent/40'
              }`}
            >
              ${preset}
            </button>
          ))}
          <input
            id="pl-amount"
            type="number"
            min={1}
            max={100000}
            value={amountUsd}
            onChange={(e) => setAmountUsd(Math.max(1, Number(e.target.value) || 0))}
            className="flex-1 min-w-[6rem] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Custom amount in USD"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pl-token" className="mb-2 block text-[10px] uppercase tracking-widest text-text-muted">
          Token
        </label>
        <select
          id="pl-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {Object.keys(CRYPTO_LOGOS).map((sym) => (
            <option key={sym} value={sym}>
              {sym} — {CRYPTO_LOGOS[sym as keyof typeof CRYPTO_LOGOS].name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pl-memo" className="mb-2 block text-[10px] uppercase tracking-widest text-text-muted">
          Memo · optional
        </label>
        <input
          id="pl-memo"
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={80}
          placeholder="Invoice #, project name, etc."
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px]"
          role="alert"
          style={{
            borderColor: 'var(--color-error)',
            backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            color: 'var(--color-error)',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || amountUsd <= 0}
          className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              generating…
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              generate a payment link
            </>
          )}
        </button>
        <span className="text-[11px] text-text-muted">
          Recipients pay with any token; we auto-convert to USDC credits.
        </span>
      </div>

      {result && (
        <div className="mt-4 border border-accent/30 bg-accent-dim/40 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-accent">Link ready</p>
          <code className="block break-all text-[11.5px] font-mono text-text-bright">{result.url}</code>
          <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-text-muted tabular-nums">
            <span>${result.amountUsd} {result.token}</span>
            <span>·</span>
            <span>expires {new Date(result.expiresAt).toLocaleString()}</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-accent transition-colors"
            aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}
          >
            {copied ? <Check className="h-3 w-3 text-accent" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      )}
    </form>
  )
}
