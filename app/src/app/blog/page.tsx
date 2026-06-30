import type { Metadata } from 'next'
import Link from 'next/link'
import { BLOG_POSTS, getAllTags } from '@/lib/blog-data'
import { ArrowRight, Calendar, Clock, Tag } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, guides, and deep dives from the OMA AI team.',
  alternates: { canonical: '/blog' },
}

export default function BlogPage() {
  const allTags = getAllTags()

  return (
    <div className="min-h-dvh bg-void text-text-secondary font-mono">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-24 sm:pb-32">
        {/* Header */}
        <header className="mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            OMA AI Blog
          </span>
          <h1 className="h1-page text-text-bright mb-4">
            News, guides & deep dives
          </h1>
          <p className="max-w-2xl text-[15px] sm:text-base text-text-secondary leading-relaxed">
            Engineering notes, protocol explainers, and product updates from the team building permissionless AI inference.
          </p>
        </header>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-text-muted uppercase tracking-wider"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Posts grid */}
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.slug}
              className="group flex flex-col border border-border bg-surface rounded-xl overflow-hidden hover:border-accent/40 transition-colors"
            >
              <Link href={`/blog/${post.slug}`} className="flex flex-col flex-1 p-5 sm:p-6">
                <div className="flex items-center gap-3 text-[11px] text-text-muted mb-3">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.readingTime} min read
                  </span>
                </div>

                <h2 className="font-display text-[16px] sm:text-lg font-bold text-text-bright mb-2 leading-snug group-hover:text-accent transition-colors">
                  {post.title}
                </h2>

                <p className="text-[13px] text-text-secondary leading-relaxed mb-4 flex-1">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-accent/5 border border-accent/10 px-2 py-0.5 text-[10px] text-accent uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors group-hover:translate-x-0.5" />
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* Empty state (should not happen with sample data) */}
        {BLOG_POSTS.length === 0 && (
          <div className="text-center py-20">
            <p className="text-text-muted text-sm">No posts yet. Check back soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}
