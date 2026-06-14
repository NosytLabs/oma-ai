/**
 * Admin / Refund Requests — M6.3 active console.
 *
 * The operator reviews pending refund requests, grants or denies them.
 * Granting atomically issues credits back to the user (see
 * `server/src/credits/refunds.ts`). Denying records a reason in the
 * audit log so the requester can see the decision in their dashboard.
 *
 * The server endpoints (`/v1/admin/refunds`, `/v1/admin/refunds/:id/grant`,
 * `/v1/admin/refunds/:id/deny`) are added by the M6.4 worker. Until that
 * lands, this page shows the same 401/500 error states the operator
 * would see in production — the UI is wired so the rollout is just the
 * server route mount.
 */
'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  Receipt,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { formatUsd } from '@/lib/utils';
import { api } from '@/lib/api';

type RefundRow = {
  id: string;
  userId: string;
  userAddress?: string;
  accountNumber?: string | null;
  depositId: string;
  amountCents: number;
  reason: string;
  status: 'pending' | 'granted' | 'denied';
  createdAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  notes?: string | null;
};

const REASON_LABEL: Record<string, string> = {
  duplicate: 'Duplicate charge',
  fraudulent: 'Fraudulent',
  requested_by_customer: 'Customer request',
  service_issue: 'Service issue',
};

function formatAddress(addr?: string) {
  if (!addr) return '—';
  if (addr.length > 16) return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
  return addr;
}

export default function AdminRefundsPage() {
  const queryClient = useQueryClient();
  const [denyTarget, setDenyTarget] = useState<RefundRow | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const refundsQuery = useQuery({
    queryKey: ['adminRefunds'],
    queryFn: () => api.admin.refunds.list(),
    staleTime: 15_000,
  });

  const grantMutation = useMutation({
    mutationFn: (id: string) => api.admin.refunds.grant(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['adminRefunds'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to grant refund');
    },
  });

  const denyMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.admin.refunds.deny(id, notes),
    onSuccess: () => {
      setActionError(null);
      setDenyTarget(null);
      setDenyNotes('');
      queryClient.invalidateQueries({ queryKey: ['adminRefunds'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to deny refund');
    },
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['adminRefunds'] });
  }, [queryClient]);

  const refunds: RefundRow[] = refundsQuery.data?.refunds ?? [];
  const pending = refunds.filter((r) => r.status === 'pending');
  const decided = refunds.filter((r) => r.status !== 'pending');

  return (
    <div className="min-h-dvh bg-[var(--color-void)] text-[var(--color-text)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="rounded border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                aria-label="Back to admin console"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                  <h1 className="text-lg font-bold font-syne tracking-tight text-[var(--color-text-bright)]">
                    Refund Requests
                  </h1>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">
                  {pending.length} pending · {decided.length} decided
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={refresh}
              className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {actionError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        {refundsQuery.isError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          >
            <Terminal className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Refund queue endpoint unavailable.</p>
              <p className="mt-1 text-xs text-amber-300/80">
                M6.4 will add <code>GET /v1/admin/refunds</code> and the grant/deny
                mutations. Until then the page renders empty.
              </p>
            </div>
          </div>
        )}

        {refundsQuery.isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
              />
            ))}
          </div>
        ) : pending.length === 0 && decided.length === 0 ? (
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-[var(--color-text-muted)]" />
            <p className="font-mono text-sm text-[var(--color-text-muted)]">
              No refund requests.
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]/70">
              User-submitted refunds will appear here for review.
            </p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section aria-labelledby="pending-heading" className="mb-8">
                <h2
                  id="pending-heading"
                  className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]"
                >
                  Pending
                </h2>
                <div className="overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                        <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          User
                        </th>
                        <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Reason
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Submitted
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-[var(--color-border)]/50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm text-[var(--color-text-secondary)]">
                              {formatAddress(r.userAddress)}
                            </div>
                            {r.accountNumber && (
                              <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
                                acct {r.accountNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                            {REASON_LABEL[r.reason] ?? r.reason}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--color-accent)]">
                            {formatUsd(r.amountCents / 100)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                            {format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => grantMutation.mutate(r.id)}
                                disabled={grantMutation.isPending}
                                className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-mono text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                                aria-label={`Grant refund of ${r.amountCents} cents`}
                              >
                                <Check className="h-3 w-3" /> Grant
                              </button>
                              <button
                                onClick={() => {
                                  setDenyTarget(r);
                                  setDenyNotes('');
                                }}
                                disabled={denyMutation.isPending}
                                className="inline-flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-mono text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                                aria-label={`Deny refund of ${r.amountCents} cents`}
                              >
                                <X className="h-3 w-3" /> Deny
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {decided.length > 0 && (
              <section aria-labelledby="decided-heading">
                <h2
                  id="decided-heading"
                  className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]"
                >
                  Decided
                </h2>
                <div className="overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                        <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          User
                        </th>
                        <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Reason
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Status
                        </th>
                        <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          Decided
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {decided.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--color-border)]/50">
                          <td className="px-4 py-3 font-mono text-sm text-[var(--color-text-secondary)]">
                            {formatAddress(r.userAddress)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                            {REASON_LABEL[r.reason] ?? r.reason}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--color-text-muted)]">
                            {formatUsd(r.amountCents / 100)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                                r.status === 'granted'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-red-500/15 text-red-300'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                            {r.decidedAt
                              ? format(new Date(r.decidedAt), 'yyyy-MM-dd HH:mm')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {denyTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deny-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDenyTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
          >
            <h2
              id="deny-modal-title"
              className="mb-1 text-lg font-semibold text-[var(--color-text-bright)]"
            >
              Deny refund?
            </h2>
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              {denyTarget.amountCents / 100 > 0
                ? formatUsd(denyTarget.amountCents / 100)
                : denyTarget.amountCents}{' '}
              · {REASON_LABEL[denyTarget.reason] ?? denyTarget.reason} — a reason is
              required and is shown to the requester in their dashboard.
            </p>
            <label
              htmlFor="deny-notes"
              className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]"
            >
              Reason
            </label>
            <textarea
              id="deny-notes"
              value={denyNotes}
              onChange={(e) => setDenyNotes(e.target.value)}
              rows={3}
              className="mb-4 w-full rounded border border-[var(--color-border)] bg-[var(--color-void)] p-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)]/50 focus:outline-none"
              placeholder="e.g. credits were spent in full; /v1/usage records confirm no failed streams"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDenyTarget(null)}
                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  denyMutation.mutate({ id: denyTarget.id, notes: denyNotes.trim() })
                }
                disabled={denyNotes.trim().length < 8 || denyMutation.isPending}
                className="rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-mono text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                {denyMutation.isPending ? 'Denying…' : 'Deny refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
