'use client'

import { useState, useRef, useEffect, ReactNode, useId } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Tab } from '../data'

/* ---------------------- CopyButton ---------------------- */

export function CopyButton({ text, id }: { text: string; id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className={`absolute right-2.5 top-2.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border bg-[var(--color-surface)]/85 text-[var(--color-text-muted)] backdrop-blur-sm transition-all hover:border-[var(--color-accent)]/60 hover:text-[var(--color-accent)] active:scale-95 ${
        copied
          ? 'border-[var(--color-accent)]/60 text-[var(--color-accent)]'
          : 'border-[var(--color-border)]/60'
      }`}
      aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
      aria-controls={id}
      aria-live="polite"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

/* ---------------------- CodeBlock ---------------------- */

export function CodeBlock({ code, title, lang }: { code: string; title?: string; lang?: string }) {
  const id = useId()
  return (
    <div className="group/code relative my-4 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      {(title || lang) && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 px-4 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            {title && (
              <span className="font-medium text-[var(--color-text-secondary)]">{title}</span>
            )}
          </div>
          {lang && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {lang}
            </span>
          )}
        </div>
      )}
      <CopyButton text={code} id={id} />
      <pre
        id={id}
        className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent"
      >
        <code className="font-mono text-[var(--color-text-secondary)] whitespace-pre">{code}</code>
      </pre>
    </div>
  )
}

/* ---------------------- TabbedCode ---------------------- */

export function TabbedCode({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0)
  const id = useId()
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div
        className="flex overflow-x-auto border-b border-[var(--color-border)]/60 bg-[var(--color-surface)]/40"
        role="tablist"
      >
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            role="tab"
            aria-selected={i === active}
            className={`relative inline-flex shrink-0 items-center gap-2 px-4 py-2.5 font-mono text-xs font-medium transition-colors ${
              i === active
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.label}
            {i === active && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-accent)]"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
      <div className="relative">
        <CopyButton text={tabs[active].code} id={id} />
        <span
          className="pointer-events-none absolute right-12 top-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]"
          aria-hidden="true"
        >
          {tabs[active].lang}
        </span>
        <pre
          id={id}
          className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent"
        >
          <code className="font-mono text-[var(--color-text-secondary)] whitespace-pre">
            {tabs[active].code}
          </code>
        </pre>
      </div>
    </div>
  )
}

/* ---------------------- SectionHeading ---------------------- */

export function SectionHeading({
  id,
  icon,
  title,
  subtitle,
  badge,
}: {
  id: string
  icon: ReactNode
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <header
      id={id}
      className="mb-8 flex items-start gap-4 scroll-mt-24 border-b border-[var(--color-border)] pb-6"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)] font-syne">
            {title}
          </h2>
          {badge && (
            <span className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-accent)]">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
          {subtitle}
        </p>
      </div>
    </header>
  )
}

/* ---------------------- SubHeading ---------------------- */

export function SubHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="mt-10 mb-3 scroll-mt-24 flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--color-text)] font-syne"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
      {children}
    </h3>
  )
}

/* ---------------------- AnimatedSection ---------------------- */

export function AnimatedSection({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true)
          obs.unobserve(el)
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -10% 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-3 opacity-0'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/* ---------------------- MethodBadge ---------------------- */

export function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  const tone =
    method === 'GET'
      ? 'border-[var(--color-info)]/30 bg-[var(--color-info)]/10 text-[var(--color-info)]'
      : 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
  return (
    <span
      className={`inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {method}
    </span>
  )
}

/* ---------------------- CollapsibleCard ---------------------- */

export function CollapsibleCard({
  defaultOpen = false,
  header,
  children,
}: {
  defaultOpen?: boolean
  header: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 transition-colors hover:border-[var(--color-border-bright)]/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[var(--color-surface)]/70"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">{header}</div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        )}
      </button>
      {open && (
        <div className="space-y-5 border-t border-[var(--color-border)]/60 bg-[var(--color-void)]/40 p-5">
          {children}
        </div>
      )}
    </div>
  )
}

/* ---------------------- InlineCode ---------------------- */

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-[var(--color-border)]/60 bg-[var(--color-panel)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-accent)]">
      {children}
    </code>
  )
}
