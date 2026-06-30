'use client'

import Link from 'next/link'
import { m } from 'framer-motion'
import { Terminal, Image as ImageIcon, Video as VideoIcon, BookOpen, ArrowUpRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface QuickAction {
  href: string
  label: string
  description: string
  icon: LucideIcon
  external?: boolean
}

const ACTIONS: QuickAction[] = [
  {
    href: '/playground',
    label: 'Open playground',
    description: 'Test prompts in the browser',
    icon: Terminal,
  },
  {
    href: '/image-generation',
    label: 'Generate image',
    description: 'Text → image models',
    icon: ImageIcon,
  },
  {
    href: '/video-generation',
    label: 'Generate video',
    description: 'Text → video models',
    icon: VideoIcon,
  },
  {
    href: 'https://docs.oma.ai',
    label: 'Read the docs',
    description: 'REST + x402 reference',
    icon: BookOpen,
    external: true,
  },
]

interface QuickActionsProps {
  className?: string
}

/**
 * Compact "what can I do next" row for the dashboard overview. Reduces the
 * "I have an account, now what?" gap between sign-in and first request.
 */
export function QuickActions({ className = '' }: QuickActionsProps) {
  return (
    <div className={`mb-6 border border-border bg-void p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-bright">Quick actions</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">Common next steps</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon
          const inner = (
            <div className="group flex h-full flex-col gap-2 bg-void p-4 transition-colors hover:bg-surface">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/20 bg-accent/10 text-accent">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <ArrowUpRight
                  className="ml-auto h-3.5 w-3.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-auto">
                <div className="text-sm font-medium text-text-bright">{action.label}</div>
                <div className="mt-0.5 text-[11px] text-text-muted">{action.description}</div>
              </div>
            </div>
          )
          return (
            <m.div
              key={action.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 * i }}
            >
              {action.external ? (
                <a
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${action.label} (opens in new tab)`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                >
                  {inner}
                </a>
              ) : (
                <Link
                  href={action.href}
                  aria-label={action.label}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                >
                  {inner}
                </Link>
              )}
            </m.div>
          )
        })}
      </div>
    </div>
  )
}
