'use client'

import { m } from 'framer-motion'
import { Database, BookOpen, FileCode2, ScrollText, PenLine, Bug } from 'lucide-react'

export interface ExampleConversation {
  id: string
  title: string
  category: string
  icon: typeof Database
  prompt: string
  model: string
  modelName: string
}

export const EXAMPLES: ExampleConversation[] = [
  {
    id: 'sql',
    title: 'Write a SQL query',
    category: 'SQL',
    icon: Database,
    prompt: 'Write a SQL query that finds the top 5 customers by total order value in the last 30 days, joining customers, orders, and order_items tables.',
    model: 'llama-3.3-70b',
    modelName: 'Llama 3.3 70B',
  },
  {
    id: 'x402',
    title: 'Explain x402 protocol',
    category: 'Technical',
    icon: BookOpen,
    prompt: 'Explain the x402 payment protocol: what problem does it solve, how does the 402 status code flow work, and how does it integrate with HTTP-based APIs?',
    model: 'claude-sonnet-4',
    modelName: 'Claude Sonnet 4',
  },
  {
    id: 'json-schema',
    title: 'Generate a JSON schema',
    category: 'Coding',
    icon: FileCode2,
    prompt: 'Generate a JSON schema for a User object with: id (uuid), email (string, required), createdAt (datetime), profile (nested object with displayName and avatarUrl), and roles (array of strings, enum: admin/member/guest).',
    model: 'gpt-4o-mini',
    modelName: 'GPT-4o mini',
  },
  {
    id: 'contract',
    title: 'Summarize a contract',
    category: 'Legal',
    icon: ScrollText,
    prompt: 'Summarize the key obligations, termination clauses, and liability limitations in a standard SaaS Master Services Agreement (MSA) in 5 bullet points.',
    model: 'claude-opus-4',
    modelName: 'Claude Opus 4',
  },
  {
    id: 'haiku',
    title: 'Write a haiku',
    category: 'Creative',
    icon: PenLine,
    prompt: 'Write a haiku about a machine learning model that dreams of electric sheep.',
    model: 'llama-3.3-70b',
    modelName: 'Llama 3.3 70B',
  },
  {
    id: 'python-debug',
    title: 'Debug Python code',
    category: 'Debug',
    icon: Bug,
    prompt: 'Find and fix the bug in this Python code:\n\n```python\ndef average(numbers):\n    total = 0\n    for n in numbers:\n        total += n\n    return total / len(numbers)\n\nprint(average([]))\n```',
    model: 'deepseek-v3.2',
    modelName: 'DeepSeek V3.2',
  },
]

interface ExampleConversationsProps {
  onSelect: (example: ExampleConversation) => void
}

export function ExampleConversations({ onSelect }: ExampleConversationsProps) {
  return (
    <div className="w-full max-w-4xl mx-auto px-2 md:px-0 py-8">
      <div className="mb-4">
        <h2 className="text-xs font-mono font-bold text-text-muted uppercase tracking-widest">
          {'// EXAMPLE CONVERSATIONS'}
        </h2>
        <p className="text-[11px] text-text-muted font-mono mt-1">
          CLICK A CARD TO PRE-FILL THE PROMPT AND SWITCH MODEL
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {EXAMPLES.map((example, i) => {
          const Icon = example.icon
          return (
            <m.button
              key={example.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              onClick={() => onSelect(example)}
              className="group text-left p-4 border border-border bg-void hover:border-success/40 hover:bg-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 flex items-center justify-center border border-border bg-surface group-hover:border-success/30 transition-colors">
                  <Icon className="w-4 h-4 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xs font-mono font-bold text-text uppercase tracking-wide truncate">
                      {example.title}
                    </h3>
                  </div>
                  <p className="text-[10px] font-mono text-text-muted line-clamp-2 leading-relaxed mb-2">
                    {example.prompt}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
                    <span className="px-1.5 py-0.5 bg-surface border border-border text-text-muted">
                      {example.category}
                    </span>
                    <span className="px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">
                      {example.modelName}
                    </span>
                  </div>
                </div>
              </div>
            </m.button>
          )
        })}
      </div>
    </div>
  )
}
