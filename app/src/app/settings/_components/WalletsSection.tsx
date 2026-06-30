'use client'

import { Copy, Check, Hexagon, Key, Loader2, Unlink, Link2, Fingerprint, Shield } from 'lucide-react'
import type { User } from '@/lib/api'
import { useWallet } from '@/components/wallet-provider'

interface WalletsSectionProps {
  user: User | null
  onCopy: (text: string, id: string) => void
  copied: string | null
  onGenerateAccountNumber: () => Promise<void>
  generatingAccount: boolean
  onUnlinkEvm: () => Promise<void>
  unlinkingEvm: boolean
}

export function WalletsSection({
  user,
  onCopy,
  copied,
  onGenerateAccountNumber,
  generatingAccount,
  onUnlinkEvm,
  unlinkingEvm,
}: WalletsSectionProps) {
  const { evmAddress, connectEvm } = useWallet()

  return (
    <div>
      <div className="mb-1">
        <h2 className="text-lg font-semibold text-text-bright">Wallets</h2>
        <p className="mt-1 text-sm text-text-muted">
          Connect a wallet for SIWE sign-in, or generate an account number for passwordless access.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {/* EVM Wallet card */}
        <div className="rounded-lg border border-border bg-void p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue/30 bg-blue/10">
              <Hexagon className="h-5 w-5 text-blue" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-sm font-semibold text-text">EVM wallet</span>
                <span className="rounded-full bg-blue/20 px-2 py-0.5 text-[10px] font-bold text-blue">Base</span>
              </div>
              {evmAddress ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent" title={evmAddress}>
                    {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
                  </span>
                  <button type="button"
                    onClick={() => onCopy(evmAddress, 'evm')}
                    aria-label="Copy EVM address"
                    className="shrink-0 rounded-lg p-2 transition-colors hover:bg-surface"
                  >
                    {copied === 'evm' ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-text-muted" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-text-muted">Not connected</span>
              )}
            </div>
            {evmAddress ? (
              <button type="button"
                onClick={onUnlinkEvm}
                disabled={unlinkingEvm}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber/30 px-3 py-1.5 text-xs font-medium text-amber transition-all hover:bg-amber/5 disabled:opacity-40"
              >
                {unlinkingEvm ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3" />
                )}
                Unlink
              </button>
            ) : (
              <button type="button"
                onClick={() => connectEvm()}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-void px-3 py-1.5 text-xs font-medium text-accent"
              >
                <Link2 className="h-3 w-3" />
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account number */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-bright">Account number</h3>
        </div>
        <p className="mb-3 text-sm text-text-muted">
          A Mullvad-style account number lets you sign in without a wallet. Save it somewhere safe — it&apos;s the only way to recover walletless access.
        </p>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-void px-4 py-4">
          {user?.accountNumber ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-mono font-bold tracking-wider text-accent">
                  {user.accountNumber}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                  <Shield className="h-3 w-3" />
                  <span>Use this instead of a wallet to sign in</span>
                </div>
              </div>
              <button type="button"
                // biome-ignore lint/style/noNonNullAssertion: value is guaranteed by preceding check
                onClick={() => onCopy(user.accountNumber!, 'accountNumber')}
                aria-label="Copy account number"
                className="rounded-lg p-2.5 transition-colors hover:bg-surface"
              >
                {copied === 'accountNumber' ? (
                  <Check className="h-5 w-5 text-success" />
                ) : (
                  <Copy className="h-5 w-5 text-text-muted" />
                )}
              </button>
            </>
          ) : (
            <>
              <div className="flex-1">
                <div className="text-sm text-text-muted">No account number generated yet</div>
                <div className="mt-1 text-[11px] text-text-muted">Generate one to enable wallet-free sign-in.</div>
              </div>
              <button type="button"
                onClick={onGenerateAccountNumber}
                disabled={generatingAccount}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-void px-4 py-2 text-xs font-semibold text-accent transition-all hover:bg-accent/10 disabled:opacity-40"
              >
                {generatingAccount ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Key className="h-3 w-3" />
                )}
                Generate
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
