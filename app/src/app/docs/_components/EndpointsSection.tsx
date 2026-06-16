'use client'

import { Terminal, Lock, Globe } from 'lucide-react'
import { ENDPOINTS } from '../data'
import { SectionHeading, AnimatedSection, CodeBlock, MethodBadge, CollapsibleCard } from './SharedComponents'

export function EndpointsSection() {
  return (
    <AnimatedSection delay={200}>
      <SectionHeading
        id="endpoints"
        icon={<Terminal className="h-5 w-5" />}
        title="Endpoints"
        subtitle="Four routes. OpenAI-compatible, so any tool that talks to OpenAI will talk to us after a base-URL swap."
        badge={`${ENDPOINTS.length} routes`}
      />

      <div className="space-y-3">
        {ENDPOINTS.map((ep) => (
          <CollapsibleCard
            key={ep.id}
            defaultOpen={ep.id === 'chat'}
            header={
              <div className="flex min-w-0 items-center gap-3">
                <MethodBadge method={ep.method} />
                <code className="truncate font-mono text-sm text-text">
                  {ep.path}
                </code>
                <span className="hidden text-xs text-text-muted sm:inline">
                  — {ep.title}
                </span>
                <span
                  className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    ep.auth.includes('None')
                      ? 'border-border bg-panel text-text-muted'
                      : 'border-accent/30 bg-accent/10 text-accent'
                  }`}
                >
                  {ep.auth.includes('None') ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {ep.auth.includes('None') ? 'public' : 'auth'}
                </span>
              </div>
            }
          >
            <p className="text-[13px] leading-relaxed text-text-muted">{ep.desc}</p>

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                Auth
              </p>
              <p className="font-mono text-[13px] text-text-secondary">{ep.auth}</p>
            </div>

            {ep.body && (
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                  Request body
                </p>
                <div className="overflow-hidden rounded-md border border-border/60 bg-panel">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(ep.body).map(([key, val], i) => (
                        <tr
                          key={key}
                          className={i > 0 ? 'border-t border-border/50' : ''}
                        >
                          <td className="w-1/3 whitespace-nowrap px-4 py-2.5 align-top font-mono text-[13px] text-accent">
                            {key}
                          </td>
                          <td className="px-4 py-2.5 align-top font-mono text-xs leading-relaxed text-text-muted">
                            {val}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                Response · 200 OK
              </p>
              <CodeBlock code={ep.response} lang="json" />
            </div>

            {ep.errors?.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                  Errors
                </p>
                <ul className="space-y-1.5 text-[13px]">
                  {ep.errors.map((e) => (
                    <li key={`${e.code}-${e.type}`} className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md border border-error/30 bg-error/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-error">
                        {e.code}
                      </span>
                      <span className="text-text-muted">
                        <code className="font-mono text-text-secondary">
                          {e.type}
                        </code>{' '}
                        — {e.when}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleCard>
        ))}
      </div>
    </AnimatedSection>
  )
}
