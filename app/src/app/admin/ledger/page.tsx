/**
 * Admin / Ledger — M6.3 active console.
 *
 * Operator-only view of the on-chain ledger wallet. Shows:
 *  - Ledger address + USDC balance
 *  - Hot vs cold wallet split (read-only summary)
 *  - Recent transfers (in + out)
 *  - "Sweep" action to consolidate hot-wallet profits into the ledger
 *
 * The server endpoints (`/v1/admin/ledger/info`, `/v1/admin/ledger/sweep`,
 * `/v1/admin/ledger/hot-vs-cold-report`) are added by the M6.1 + M6.2
 * workers. Until those land the page renders the same 401/500 the
 * operator would see in production.
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  Flame,
  Terminal,
  AlertTriangle,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

type Transfer = {
  txHash: string;
  direction: 'in' | 'out';
  amountUsdc: string;
  counterparty: string;
  source: 'x402' | 'inference' | 'manual';
  blockNumber: number;
  timestamp: string;
};

function shortenHash(hash: string) {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function shortenAddress(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function AdminLedgerPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const infoQuery = useQuery({
    queryKey: ['adminLedgerInfo'],
    queryFn: () => api.admin.ledger.info(),
    staleTime: 15_000,
  });

  const hotVsColdQuery = useQuery({
    queryKey: ['adminLedgerHotVsCold'],
    queryFn: () => api.admin.ledger.hotVsCold(),
    staleTime: 30_000,
  });

  const sweepMutation = useMutation({
    mutationFn: () => api.admin.ledger.sweep(),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['adminLedgerInfo'] });
      queryClient.invalidateQueries({ queryKey: ['adminLedgerHotVsCold'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Sweep failed');
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['adminLedgerInfo'] });
    queryClient.invalidateQueries({ queryKey: ['adminLedgerHotVsCold'] });
  };

  const info = infoQuery.data;
  const hotVsCold = hotVsColdQuery.data;
  const transfers: Transfer[] = info?.recentTransfers ?? [];

  const balanceUsdc = info?.balanceUsdc ?? '0';

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
                  <Wallet className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                  <h1 className="text-lg font-bold font-syne tracking-tight text-[var(--color-text-bright)]">
                    Ledger
                  </h1>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">
                  On-chain cold storage for operator profits
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={refresh}
                className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => sweepMutation.mutate()}
                disabled={sweepMutation.isPending}
                className="flex items-center gap-2 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-3 py-2 text-sm font-mono text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {sweepMutation.isPending ? 'Sweeping…' : 'Sweep hot → ledger'}
              </motion.button>
            </div>
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

        {(infoQuery.isError || hotVsColdQuery.isError) && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          >
            <Terminal className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Ledger endpoint unavailable.</p>
              <p className="mt-1 text-xs text-amber-300/80">
                M6.1 + M6.2 will add <code>GET /v1/admin/ledger/info</code>,{' '}
                <code>POST /v1/admin/ledger/sweep</code>, and the hot-vs-cold
                report. Until then this page renders the empty state.
              </p>
            </div>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                Ledger · Base
              </span>
            </div>
            <p className="text-3xl font-bold font-mono text-[var(--color-text-bright)]">
              {info ? `${balanceUsdc} USDC` : infoQuery.isLoading ? '…' : '—'}
            </p>
            {info && (
              <p className="mt-2 break-all font-mono text-[11px] text-[var(--color-text-muted)]">
                {info.address}
              </p>
            )}
            {info?.lastSweptAt && (
              <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                Last sweep {format(new Date(info.lastSweptAt), 'yyyy-MM-dd HH:mm')}
              </p>
            )}
          </div>

          {hotVsCold ? (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-[var(--color-amber)]" aria-hidden="true" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Hot · Cold split
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">
                    Hot ({hotVsCold.hot.role})
                  </p>
                  <p className="mt-1 font-mono text-lg text-[var(--color-text-bright)]">
                    {hotVsCold.hot.balanceUsdc} USDC
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--color-text-muted)]">
                    {hotVsCold.hot.address}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">
                    Cold ({hotVsCold.cold.role})
                  </p>
                  <p className="mt-1 font-mono text-lg text-[var(--color-text-bright)]">
                    {hotVsCold.cold.balanceUsdc} USDC
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--color-text-muted)]">
                    {hotVsCold.cold.address}
                  </p>
                </div>
              </div>
              {hotVsCold.lastSweep && (
                <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">
                  Last sweep {hotVsCold.lastSweep.amountUsdc} USDC ·{' '}
                  {shortenHash(hotVsCold.lastSweep.txHash)} ·{' '}
                  {format(new Date(hotVsCold.lastSweep.at), 'yyyy-MM-dd HH:mm')}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                Hot · Cold split
              </p>
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                Hot vs cold report will appear once M6.1 + M6.2 mount the endpoint.
              </p>
            </div>
          )}
        </div>

        <section aria-labelledby="transfers-heading">
          <h2
            id="transfers-heading"
            className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]"
          >
            Recent transfers
          </h2>
          {transfers.length === 0 ? (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                No transfers yet.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      Dir
                    </th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      Source
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      Counterparty
                    </th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      Tx
                    </th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr
                      key={`${t.txHash}-${t.direction}`}
                      className="border-b border-[var(--color-border)]/50"
                    >
                      <td className="px-4 py-3">
                        {t.direction === 'in' ? (
                          <ArrowDownLeft
                            className="h-4 w-4 text-emerald-400"
                            aria-label="incoming"
                          />
                        ) : (
                          <ArrowUpRight
                            className="h-4 w-4 text-[var(--color-amber)]"
                            aria-label="outgoing"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                        {t.source}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-text-bright)]">
                        {t.amountUsdc} USDC
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                        {shortenAddress(t.counterparty)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-accent)]">
                        {shortenHash(t.txHash)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                        {format(new Date(t.timestamp), 'yyyy-MM-dd HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
