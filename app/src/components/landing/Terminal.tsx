'use client'

import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return (
    <button
      onClick={handleCopy}
      className="absolute right-3 top-3 rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-surface)]/70 px-2.5 py-1.5 text-xs text-[var(--color-text-muted)] transition-all hover:border-[var(--color-cyan)]/50 hover:text-[var(--color-cyan)] hover:bg-[var(--color-surface-elevated)]"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function TerminalBlock({
  code,
  filename,
}: {
  code: string
  filename?: string
}) {
  return (
    <div className="relative rounded-lg border border-[var(--color-border)]/50 bg-[var(--color-void)]/80 overflow-hidden">
      {filename && (
        <div className="flex items-center gap-2 border-b border-[var(--color-border)]/50 bg-[var(--color-surface)]/50 px-4 py-2.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-error)]/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-success)]/80" />
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">{filename}</span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-[var(--color-text-secondary)] font-mono">
          <code>{code}</code>
        </pre>
        <CopyButton text={code} />
      </div>
    </div>
  )
}

export { TerminalBlock, CopyButton }