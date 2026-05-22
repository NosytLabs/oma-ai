'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import { Copy, Check, RotateCcw, Edit3 } from 'lucide-react'

interface MessageContentProps {
  content: string
  role: 'user' | 'assistant' | 'system'
  onRegenerate?: () => void
  onEdit?: (newContent: string) => void
  streaming?: boolean
}

export function MessageContent({ content, role, onRegenerate, onEdit, streaming }: MessageContentProps) {
  const [copied, setCopied] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editContent, setEditContent] = useState(content)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (role === 'user') {
    return (
      <div className="relative group">
        <p className="text-text whitespace-pre-wrap">{content}</p>
        <div className="absolute -top-8 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="rounded p-1.5 hover:bg-surface text-text-dim hover:text-cyan"
            title="Copy message"
          >
            {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
          </button>
          {onEdit && (
            <button
              onClick={() => { setEditContent(content); setShowEdit(true); }}
              className="rounded p-1.5 hover:bg-surface text-text-dim hover:text-cyan"
              title="Edit message"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
        {showEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEdit(false)}>
            <div className="bg-panel rounded-lg border border-border p-4 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold mb-3 text-text">Edit Message</h3>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-32 bg-surface border border-border rounded p-2 text-sm text-text resize-none focus:outline-none focus:border-cyan/50"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setShowEdit(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={() => { onEdit?.(editContent); setShowEdit(false); }} className="btn-primary text-sm">Resend</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (role === 'assistant') {
    return (
      <div className="relative group">
        <div className="prose prose-sm max-w-none prose-p:text-text prose-pre:bg-surface prose-pre:border prose-pre:border-border prose-code:text-pink prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-a:text-cyan prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
        {content && (
          <div className="absolute -top-8 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="rounded p-1.5 hover:bg-surface text-text-dim hover:text-cyan"
              title="Copy response"
            >
              {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
            </button>
            {onRegenerate && !streaming && (
              <button
                onClick={onRegenerate}
                className="rounded p-1.5 hover:bg-surface text-text-dim hover:text-cyan"
                title="Regenerate response"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {streaming && (
          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-cyan" />
        )}
      </div>
    )
  }

  return <p className="text-text-dim text-sm">{content}</p>
}