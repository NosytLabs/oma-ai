import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostBySlug, BLOG_POSTS } from '@/lib/blog-data'
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: 'Not Found' }

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  }
}

/* Simple inline markdown parser — no dangerouslySetInnerHTML */
function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCode = false
  let codeLang = ''
  let codeLines: string[] = []
  let listBuffer: React.ReactNode[] = []
  let listType: 'ul' | 'ol' | null = null
  let listKey = 0

  function flushList() {
    if (listBuffer.length === 0 || !listType) return
    if (listType === 'ul') {
      elements.push(
        <ul key={`ul-${listKey++}`} className="space-y-2 my-4 list-none p-0">
          {listBuffer}
        </ul>
      )
    } else {
      elements.push(
        <ol key={`ol-${listKey++}`} className="space-y-2 my-4 list-none p-0">
          {listBuffer}
        </ol>
      )
    }
    listBuffer = []
    listType = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={i} className="font-display text-xl sm:text-2xl font-bold text-text-bright mt-10 mb-4 scroll-mt-24">
          {line.slice(3)}
        </h2>
      )
      continue
    }

    if (line.startsWith('```')) {
      flushList()
      if (!inCode) {
        inCode = true
        codeLang = line.slice(3).trim()
        codeLines = []
      } else {
        inCode = false
        elements.push(
          <div key={i} className="my-6 rounded-xl border border-border bg-panel overflow-hidden">
            {codeLang && (
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
                <span className="text-[11px] font-medium text-text-muted font-mono uppercase">{codeLang}</span>
              </div>
            )}
            <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-text-secondary">
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        )
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (line.startsWith('- ')) {
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      const text = line.slice(2)
      listBuffer.push(
        <li key={i} className="flex items-start gap-2 text-[14px] text-text-secondary leading-relaxed">
          <span className="mt-2 h-1 w-1 rounded-full bg-accent shrink-0" />
          <InlineText text={text} />
        </li>
      )
      continue
    }

    if (/^\d+\. /.test(line)) {
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      const text = line.replace(/^\d+\. /, '')
      listBuffer.push(
        <li key={i} className="flex items-start gap-2 text-[14px] text-text-secondary leading-relaxed">
          <span className="text-accent font-mono text-xs mt-0.5 shrink-0">•</span>
          <InlineText text={text} />
        </li>
      )
      continue
    }

    flushList()

    if (line.trim() === '') {
      elements.push(<div key={i} className="h-3" />)
      continue
    }

    elements.push(
      <p key={i} className="text-[14px] sm:text-[15px] text-text-secondary leading-relaxed">
        <InlineText text={line} />
      </p>
    )
  }

  flushList()
  return elements
}

/* Renders inline markdown: `code`, **bold** */
function InlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Find the earliest special pattern
    const codeMatch = remaining.match(/`([^`]+)`/)
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/)

    const codeIdx = codeMatch?.index ?? Infinity
    const boldIdx = boldMatch?.index ?? Infinity

    if (codeIdx === Infinity && boldIdx === Infinity) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    if (codeIdx < boldIdx && codeMatch) {
      if (codeIdx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, codeIdx)}</span>)
      }
      parts.push(
        <code key={key++} className="text-accent font-mono text-[13px]">
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeIdx + codeMatch[0].length)
    } else if (boldMatch) {
      if (boldIdx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldIdx)}</span>)
      }
      parts.push(
        <strong key={key++} className="text-text-bright">
          {boldMatch[1]}
        </strong>
      )
      remaining = remaining.slice(boldIdx + boldMatch[0].length)
    } else {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
  }

  return <>{parts}</>
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  return (
    <div className="min-h-dvh bg-void text-text-secondary font-mono">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-24 sm:pb-32">
        {/* Back link */}
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All posts
        </Link>

        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted mb-4">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readingTime} min read
            </span>
          </div>

          <h1 className="h1-page text-text-bright mb-4">{post.title}</h1>
          <p className="text-[15px] sm:text-base text-text-secondary leading-relaxed">
            {post.excerpt}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[11px] text-accent uppercase tracking-wider"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        </header>

        {/* Divider */}
        <div className="h-px bg-border mb-10" />

        {/* Content */}
        <article className="max-w-none">
          {renderContent(post.content)}
        </article>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-text-muted">
              Written by <span className="text-text-secondary">{post.author}</span>
            </span>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All posts
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
