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
      className="absolute right-3 top-3 rounded border border-border bg-surface px-2 py-1 text-xs text-text-dim transition-colors hover:border-cyan hover:text-cyan"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-cyan" /> : <Copy className="h-3.5 w-3.5" />}
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
    <div className="relative rounded-lg border border-border bg-panel overflow-hidden">
      {filename && (
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-pink/60" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber/60" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan/60" />
          <span className="ml-2 text-xs text-text-dim">{filename}</span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-text">
          <code>{code}</code>
        </pre>
        <CopyButton text={code} />
      </div>
    </div>
  )
}

export { TerminalBlock, CopyButton }