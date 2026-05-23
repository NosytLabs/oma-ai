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
      className="absolute right-3 top-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1.5 text-xs text-zinc-500 transition-all hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-zinc-700"
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
    <div className="relative rounded-xl border border-zinc-800/50 bg-zinc-950/80 overflow-hidden">
      {filename && (
        <div className="flex items-center gap-2 border-b border-zinc-800/50 bg-zinc-900/50 px-4 py-2.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-xs text-zinc-500">{filename}</span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-zinc-300 font-mono">
          <code>{code}</code>
        </pre>
        <CopyButton text={code} />
      </div>
    </div>
  )
}

export { TerminalBlock, CopyButton }