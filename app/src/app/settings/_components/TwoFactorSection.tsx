'use client'

import { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Shield, ShieldOff, AlertTriangle, Copy, Check, X, Loader2, KeyRound, Smartphone } from 'lucide-react'
import { api, type User } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface TwoFactorSectionProps {
  user: User | null
  onUserChange: (user: User) => void
  onError: (error: string) => void
}

type SetupState =
  | { phase: 'idle' }
  | { phase: 'setup'; qrCodeDataUrl: string; secret: string; otpauthUri: string }
  | { phase: 'verify'; secret: string; code: string; error: string | null; submitting: boolean }
  | { phase: 'backup-codes'; codes: string[]; copied: boolean }
  | { phase: 'disable'; code: string; submitting: boolean; error: string | null }

/**
 * 2FA management widget. Lives inside the Profile section.
 *
 * Flow when enabling:
 *   idle  → setup  (POST /auth/2fa/setup, render QR)
 *   setup → verify (user scans, types 6-digit code, POST /auth/2fa/verify)
 *   verify → backup-codes (show one-time backup codes, require copy)
 *
 * Flow when disabling: idle → disable (confirm with TOTP code, POST /auth/2fa/disable).
 */
export function TwoFactorSection({ user, onUserChange, onError }: TwoFactorSectionProps) {
  const toast = useToast()
  const [state, setState] = useState<SetupState>({ phase: 'idle' })

  const enabled = Boolean(user?.twoFactorEnabled)
  const backupCodesRemaining = user?.backupCodesRemaining ?? 0

  const startSetup = async () => {
    try {
      const result = await api.auth.setup2FA()
      setState({
        phase: 'setup',
        qrCodeDataUrl: result.qrCodeDataUrl,
        secret: result.secret,
        otpauthUri: result.otpauthUri,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start 2FA setup'
      onError(msg)
    }
  }

  const startVerify = () => {
    if (state.phase !== 'setup') return
    setState({ phase: 'verify', secret: state.secret, code: '', error: null, submitting: false })
  }

  const submitVerify = async () => {
    if (state.phase !== 'verify') return
    if (!/^\d{6}$/.test(state.code)) {
      setState({ ...state, error: 'Enter the 6-digit code from your authenticator app' })
      return
    }
    setState({ ...state, submitting: true, error: null })
    try {
      await api.auth.verify2FA(state.code)
      const codesResp = await api.auth.getBackupCodes()
      setState({ phase: 'backup-codes', codes: codesResp.backupCodes, copied: false })
      // Reflect the new state in the parent profile so the badge flips.
      if (user) {
        onUserChange({
          ...user,
          twoFactorEnabled: true,
          backupCodesRemaining: codesResp.remaining,
        })
      }
      toast.success('Two-factor authentication enabled')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid code'
      setState({ ...state, submitting: false, error: msg })
    }
  }

  const close = () => setState({ phase: 'idle' })

  const startDisable = () => {
    setState({ phase: 'disable', code: '', submitting: false, error: null })
  }

  const submitDisable = async () => {
    if (state.phase !== 'disable') return
    if (!/^\d{6}$/.test(state.code)) {
      setState({ ...state, error: 'Enter a valid 6-digit code' })
      return
    }
    setState({ ...state, submitting: true, error: null })
    try {
      await api.auth.disable2FA(state.code)
      if (user) {
        onUserChange({ ...user, twoFactorEnabled: false, backupCodesRemaining: undefined })
      }
      toast.success('Two-factor authentication disabled')
      setState({ phase: 'idle' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to disable 2FA'
      setState({ ...state, submitting: false, error: msg })
    }
  }

  const copyAllCodes = async () => {
    if (state.phase !== 'backup-codes') return
    await navigator.clipboard.writeText(state.codes.join('\n'))
    setState({ ...state, copied: true })
    toast.success('Backup codes copied to clipboard')
  }

  return (
    <>
      <div className="mt-4 rounded-lg border border-border bg-void p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-text-bright">Two-factor authentication</div>
            <div className="mt-0.5 text-xs text-text-muted">
              {enabled
                ? `${backupCodesRemaining} backup code${backupCodesRemaining === 1 ? '' : 's'} remaining`
                : 'Add an extra layer of security to your account.'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                enabled
                  ? 'border border-success/30 bg-success/10 text-success'
                  : 'border border-border bg-surface text-text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  enabled ? 'bg-success' : 'bg-text-muted'
                }`}
              />
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
            {enabled ? (
              <button type="button"
                onClick={startDisable}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-void px-2.5 py-1.5 text-[11px] font-medium text-text-muted transition-colors hover:border-error/30 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ShieldOff className="h-3 w-3" aria-hidden="true" />
                Disable
              </button>
            ) : (
              <button type="button"
                onClick={startSetup}
                className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Shield className="h-3 w-3" aria-hidden="true" />
                Enable
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(state.phase === 'setup' || state.phase === 'verify' || state.phase === 'backup-codes') && (
          <TwoFactorModal
            state={state}
            onClose={close}
            onScanComplete={startVerify}
            onVerify={submitVerify}
            onCodeChange={(code) => state.phase === 'verify' && setState({ ...state, code, error: null })}
            onCopyCodes={copyAllCodes}
            onCopiedChange={(copied) => state.phase === 'backup-codes' && setState({ ...state, copied })}
          />
        )}

        {state.phase === 'disable' && (
          <DisableModal
            code={state.code}
            submitting={state.submitting}
            error={state.error}
            onCodeChange={(code) => setState({ ...state, code, error: null })}
            onSubmit={submitDisable}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </>
  )
}

interface TwoFactorModalProps {
  state: Extract<SetupState, { phase: 'setup' | 'verify' | 'backup-codes' }>
  onClose: () => void
  onScanComplete: () => void
  onVerify: () => void
  onCodeChange: (code: string) => void
  onCopyCodes: () => void
  onCopiedChange: (copied: boolean) => void
}

function TwoFactorModal({
  state,
  onClose,
  onScanComplete,
  onVerify,
  onCodeChange,
  onCopyCodes,
  onCopiedChange,
}: TwoFactorModalProps) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="twofa-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm p-4"
    >
      <m.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
            <Smartphone className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 id="twofa-title" className="text-sm font-semibold text-text-bright">
            {state.phase === 'setup' && 'Scan this QR code'}
            {state.phase === 'verify' && 'Enter the 6-digit code'}
            {state.phase === 'backup-codes' && 'Save your backup codes'}
          </h3>
          <button type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1 text-text-muted hover:bg-surface hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {state.phase === 'setup' && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Open your authenticator app (1Password, Authy, Google Authenticator) and scan the QR code below.
            </p>
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-void p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.qrCodeDataUrl}
                alt="2FA QR code"
                className="h-48 w-48 rounded bg-white p-2"
                width={192}
                height={192}
              />
              <code className="break-all rounded bg-surface px-2 py-1 font-mono text-[11px] text-text-muted">
                {state.secret}
              </code>
            </div>
            <button type="button"
              onClick={onScanComplete}
              className="w-full rounded-md border border-accent bg-accent px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              I&apos;ve scanned the code
            </button>
          </div>
        )}

        {state.phase === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Enter the 6-digit code shown in your authenticator app to confirm setup.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={state.code}
              onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && onVerify()}
              placeholder="000000"
              className="w-full rounded-md border border-border bg-void px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label="6-digit verification code"
            />
            {state.error && (
              <div className="flex items-center gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {state.error}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button"
                onClick={onClose}
                disabled={state.submitting}
                className="flex-1 rounded-md border border-border bg-transparent px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-40"
              >
                Cancel
              </button>
              <button type="button"
                onClick={onVerify}
                disabled={state.submitting || state.code.length !== 6}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-accent bg-accent px-4 py-2 text-xs font-semibold text-void transition-colors hover:bg-accent/90 disabled:opacity-40"
              >
                {state.submitting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Verifying…
                  </>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
          </div>
        )}

        {state.phase === 'backup-codes' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Save these codes somewhere safe. Each one can be used <strong>once</strong> if you lose your authenticator.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-void p-4">
              {state.codes.map((code) => (
                <code
                  key={code}
                  className="rounded bg-surface px-2 py-1 text-center font-mono text-xs text-text"
                >
                  {code}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button"
                onClick={onCopyCodes}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-void px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text"
              >
                {state.copied ? (
                  <>
                    <Check className="h-3 w-3 text-success" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Copy all
                  </>
                )}
              </button>
              <button type="button"
                onClick={() => {
                  onCopiedChange(true)
                  onClose()
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-accent bg-accent px-4 py-2 text-xs font-semibold text-void transition-colors hover:bg-accent/90"
              >
                <KeyRound className="h-3 w-3" aria-hidden="true" />
                I&apos;ve saved them
              </button>
            </div>
          </div>
        )}
      </m.div>
    </m.div>
  )
}

interface DisableModalProps {
  code: string
  submitting: boolean
  error: string | null
  onCodeChange: (code: string) => void
  onSubmit: () => void
  onClose: () => void
}

function DisableModal({ code, submitting, error, onCodeChange, onSubmit, onClose }: DisableModalProps) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="twofa-disable-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm p-4"
    >
      <m.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        className="w-full max-w-md rounded-xl border border-error/30 bg-panel p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-error/30 bg-error/10 text-error">
            <ShieldOff className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 id="twofa-disable-title" className="text-sm font-semibold text-error">
            Disable two-factor authentication?
          </h3>
          <button type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1 text-text-muted hover:bg-surface hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-text-secondary">
          Enter a current code from your authenticator to confirm. Your account will rely only on your wallet signature.
        </p>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="000000"
          className="w-full rounded-md border border-border bg-void px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-text placeholder:text-text-muted focus:border-error focus:outline-none focus:ring-1 focus:ring-error"
          aria-label="6-digit verification code"
        />
        {error && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-md border border-border bg-transparent px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-40"
          >
            Cancel
          </button>
          <button type="button"
            onClick={onSubmit}
            disabled={submitting || code.length !== 6}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-error bg-error/10 px-4 py-2 text-xs font-semibold text-error transition-colors hover:bg-error/20 disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Disabling…
              </>
            ) : (
              'Disable 2FA'
            )}
          </button>
        </div>
      </m.div>
    </m.div>
  )
}
