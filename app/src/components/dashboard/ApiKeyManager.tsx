'use client'

import { memo, useState } from 'react'
import { maskKey } from '@/lib/utils'
import type { ApiKey } from '@/lib/api'

interface ApiKeyManagerProps {
  keys: ApiKey[]
  loading: boolean
  creating: boolean
  showCreateForm: boolean
  newKeyName: string
  copied: string | null
  revokingId: string | null
  onCopy: (text: string, id: string) => void
  onRevokeKey: (keyId: string) => void
  onCreateKey: () => void
  setShowCreateForm: (show: boolean) => void
  setNewKeyName: (name: string) => void
}

function ApiKeyManagerComponent({
  keys,
  loading,
  creating,
  showCreateForm,
  newKeyName,
  copied,
  revokingId,
  onCopy,
  onRevokeKey,
  onCreateKey,
  setShowCreateForm,
  setNewKeyName,
}: ApiKeyManagerProps) {
  const [confirmKeyId, setConfirmKeyId] = useState<string | null>(null)

  const handleRevokeClick = (keyId: string) => {
    setConfirmKeyId(keyId)
  }

  const handleConfirmRevoke = () => {
    if (confirmKeyId) {
      onRevokeKey(confirmKeyId)
      setConfirmKeyId(null)
    }
  }

  const handleCancelRevoke = () => {
    setConfirmKeyId(null)
  }

  const keyToRevoke = keys.find(k => k.id === confirmKeyId)

  return (
    <>
      <div className="flex flex-col p-6">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">ACCESS_KEYS</h2>
          </div>
          <button 
            onClick={() => setShowCreateForm(true)} 
            className="group flex items-center justify-center border border-border-bright bg-surface px-4 py-3 min-h-[44px] min-w-[44px] text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:border-success hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:bg-surface-elevated"
          >
            [ NEW_KEY ]
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 border border-success/20 bg-success/10 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCreateKey()}
                placeholder="ENV_IDENTIFIER"
                className="flex-1 border border-border bg-void px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-success focus:outline-none focus:ring-1 focus:ring-success disabled:opacity-50"
                autoFocus
                disabled={creating}
              />
              <div className="flex gap-3">
                <button
                  onClick={onCreateKey}
                  disabled={creating || !newKeyName.trim()}
                  className="flex items-center justify-center border border-success/20 bg-success/10 px-6 py-2 text-xs uppercase tracking-widest text-success transition-colors hover:bg-success/20 hover:text-success/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {creating ? 'GENERATING...' : 'GENERATE'}
                </button>
                <button
                  onClick={() => { setShowCreateForm(false); setNewKeyName('') }}
                  className="flex items-center justify-center border border-border bg-transparent px-4 py-2 text-xs uppercase tracking-widest text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                  disabled={creating}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && keys.length === 0 ? (
          <div className="border border-border p-4 text-xs uppercase tracking-widest text-text-muted">
            <span className="inline-block h-2 w-2 bg-text-muted animate-pulse mr-2" />
            READING_REGISTRY...
          </div>
        ) : keys.length === 0 ? (
          <div className="border border-border p-8 text-center">
            <div className="mb-3 text-xs uppercase tracking-widest text-text-muted">REGISTRY_EMPTY</div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 flex items-center justify-center border border-success/20 bg-success/10 px-6 py-3 min-h-[44px] mx-auto text-xs uppercase tracking-widest text-success transition-colors hover:bg-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              [ CREATE FIRST KEY ]
            </button>
          </div>
        ) : (
          <div className="border border-border">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-void border-b border-border last:border-b-0 hover:bg-surface transition-colors"
              >
                <div className="mb-4 sm:mb-0">
                  <div className="text-sm font-medium text-text">{key.name}</div>
                  <div className="mt-1 text-xs text-text-muted font-mono">{maskKey(key.prefix)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-[10px] uppercase tracking-widest text-text-muted hidden sm:block">
                    {key.createdAt ? new Date(key.createdAt).toISOString().split('T')[0] : 'UNKNOWN'}
                  </div>
                  <button
                    onClick={() => onCopy(key.prefix, `prefix-${key.id}`)}
                    aria-label="Copy API key prefix"
                    className="flex items-center justify-center px-3 py-3 min-h-[44px] min-w-[44px] text-xs uppercase tracking-widest text-text-muted hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:text-success active:text-success/80"
                  >
                    {copied === `prefix-${key.id}` ? '[ COPIED ]' : '[ COPY ]'}
                  </button>
                  <button
                    onClick={() => handleRevokeClick(key.id)}
                    disabled={revokingId === key.id || confirmKeyId !== null}
                    aria-label="Revoke API key"
                    className="flex items-center justify-center px-3 py-3 min-h-[44px] min-w-[44px] text-xs uppercase tracking-widest text-text-muted hover:text-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:text-pink disabled:opacity-50 active:text-pink/80"
                  >
                    {revokingId === key.id ? '[ REVOKING ]' : '[ REVOKE ]'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmKeyId && keyToRevoke && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="revoke-dialog-title"
          aria-describedby="revoke-dialog-description"
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm"
        >
          <div className="mx-4 w-full max-w-md border border-border bg-panel p-6 shadow-2xl">
            <h3 id="revoke-dialog-title" className="mb-2 text-sm font-semibold uppercase tracking-widest text-pink">
              CONFIRM_KEY_REVOCATION
            </h3>
            <p id="revoke-dialog-description" className="mb-6 text-xs text-text-secondary">
              You are about to revoke key <span className="font-mono text-text">{keyToRevoke.name}</span>. This action is irreversible. Any applications using this key will immediately lose access.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelRevoke}
                className="flex items-center justify-center border border-border bg-transparent px-4 py-2 text-xs uppercase tracking-widest text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmRevoke}
                className="flex items-center justify-center border border-pink/20 bg-pink/10 px-6 py-2 text-xs uppercase tracking-widest text-pink transition-colors hover:bg-pink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                REVOKE_KEY
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export const ApiKeyManager = memo(ApiKeyManagerComponent, (prev, next) => {
  return prev.keys === next.keys &&
    prev.loading === next.loading &&
    prev.creating === next.creating &&
    prev.showCreateForm === next.showCreateForm &&
    prev.newKeyName === next.newKeyName &&
    prev.copied === next.copied &&
    prev.revokingId === next.revokingId
})