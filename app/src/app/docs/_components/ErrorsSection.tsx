// ponytail: production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
'use client'

import { AlertCircle } from 'lucide-react'
import { ERROR_CODES, ERROR_FORMAT } from '../data'
import { SectionHeading, AnimatedSection, SubHeading, CodeBlock } from './SharedComponents'

const retryCode = `import time
from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_...",
    base_url="https://api.oma-ai.com/v1",
)

for attempt in range(5):
    try:
        response = client.chat.completions.create(
            model="llama-3.2-3b",
            messages=[{"role": "user", "content": "Hi"}],
        )
        print(response.choices[0].message.content)
        break
    except Exception as e:
        status = getattr(e, "status_code", None)
        if status == 429:
            # Rate limited — back off using X-RateLimit-Reset
            wait = int(getattr(e, "headers", {}).get("X-RateLimit-Reset", 2 ** attempt))
            time.sleep(min(wait, 60))
        elif status and 500 <= status < 600:
            # Server error — exponential backoff
            time.sleep(2 ** attempt)
        else:
            raise`

export function ErrorsSection() {
  return (
    <AnimatedSection delay={600}>
      <SectionHeading
        id="errors"
        icon={<AlertCircle className="h-5 w-5" />}
        title="Errors"
        subtitle="Every error comes back as JSON with a stable shape. The HTTP status alone is enough to branch on."
      />

      <SubHeading id="err-format">Response format</SubHeading>
      <div className="mb-8">
        <CodeBlock code={ERROR_FORMAT} title="Error body" lang="json" />
      </div>

      <SubHeading id="err-common">Common errors</SubHeading>
      <div className="mb-8 overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/40">
              <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Code
              </th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Type
              </th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Description
              </th>
              <th className="hidden px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] md:table-cell">
                Fix
              </th>
            </tr>
          </thead>
          <tbody>
            {ERROR_CODES.map((e, i) => (
              <tr
                key={e.code}
                className={`border-b border-[var(--color-border)]/40 transition-colors last:border-b-0 hover:bg-[var(--color-surface)]/30 ${
                  i % 2 === 1 ? 'bg-[var(--color-surface)]/15' : ''
                }`}
              >
                <td className="px-4 py-3 font-mono font-bold text-[var(--color-error)]">{e.code}</td>
                <td className="px-4 py-3 font-mono text-[13px] text-[var(--color-warning)]">
                  {e.type}
                </td>
                <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{e.desc}</td>
                <td className="hidden px-4 py-3 text-[13px] text-[var(--color-text-muted)] md:table-cell">
                  {e.fix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHeading id="err-retry">Retry pattern</SubHeading>
      <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
        A reference retry loop that respects the{' '}
        <code className="rounded border border-[var(--color-border)]/60 bg-[var(--color-panel)] px-1 font-mono text-[0.85em] text-[var(--color-accent)]">
          X-RateLimit-Reset
        </code>{' '}
        header and uses exponential backoff for transient 5xx responses.
      </p>
      <CodeBlock code={retryCode} title="Python · exponential backoff" lang="python" />
    </AnimatedSection>
  )
}
