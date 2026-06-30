'use client'

import { Download } from 'lucide-react'

type ExportButtonProps = {
  onClick: () => void
  label?: string
  className?: string
}

export function ExportButton({ onClick, label = 'Export CSV', className }: ExportButtonProps) {
  return (
    <button type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text text-sm font-mono transition-colors ${className ?? ''}`}
    >
      <Download className="w-3.5 h-3.5" aria-hidden="true" /> {label}
    </button>
  )
}
