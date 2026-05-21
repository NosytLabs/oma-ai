'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { ConnectButton } from '@/components/connect-button'
import { api, ApiError } from '@/lib/api'
import { 
  Hexagon, 
  Copy, 
  Check, 
  ExternalLink, 
  Shield, 
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react'
import { SiweMessage } from 'siwe'

interface GetApiKeyProps {
  onSuccess?: (address: string, apiKey: string) => void
}

export function GetApiKey({ onSuccess }: GetApiKeyProps) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync, isPending: isSigning } = useSignMessage()

  const [apiKey, setApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [signing, setSigning] = useState(false)
  const [, setHasExistingKey] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for existing API key in localStorage on mount
  useEffect(() => {
    if (address) {
      const storedKey = localStorage.getItem(`oma_api_key_${address.toLowerCase()}`)
      if (storedKey) {
        setApiKey(storedKey)
      }
    }
  }, [address])

  const handleSignAndGetKey = async () => {
    if (!address) return

    setSigning(true)
    setError(null)

    try {
      // Get nonce from backend
      const nonceResponse = await api.auth.getNonce(address)
      const nonce = nonceResponse.nonce
      
      // Create SIWE message
      const domain = typeof window !== 'undefined' ? window.location.host : 'oma-ai.com'
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://oma-ai.com'

      const siweMessage = new SiweMessage({
        domain,
        address,
        statement: 'Sign in to OMA AI to generate your API key for accessing AI inference services.',
        uri: origin,
        version: '1',
        chainId: 8453, // Base chain ID
        nonce,
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      })

      const messageToSign = siweMessage.prepareMessage()

      // Sign the message
      const signature = await signMessageAsync({ message: messageToSign })

      // Send to backend
      const response = await api.auth.wallet(messageToSign, signature)
      
      if (response.apiKey) {
        // First time: backend returns the API key (shown ONCE)
        localStorage.setItem(`oma_api_key_${address.toLowerCase()}`, response.apiKey)
        setApiKey(response.apiKey)
        
        if (onSuccess) {
          onSuccess(address, response.apiKey)
        }
      } else if (response.warning) {
        // Returning user: API key already exists
        setHasExistingKey(true)
        setError(response.warning)
      }
    } catch (err) {
      console.error('SIWE signing failed:', err)
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Signing failed. Please try again.')
      }
    } finally {
      setSigning(false)
    }
  }

  const handleCopy = async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Not connected state
  if (!isConnected || !address) {
    return (
      <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-panel p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan/10">
            <Sparkles className="h-8 w-8 text-cyan" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-text">
            Connect Wallet. Get API Key.
          </h2>
          <p className="text-sm text-text-dim">
            Sign in with your wallet to instantly generate an API key. No accounts, no KYC.
          </p>
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green/20">
              <Hexagon className="h-4 w-4 text-green" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text">1. Connect Wallet</p>
              <p className="text-[10px] text-text-dim">Connect via MetaMask, Coinbase, or WalletConnect</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/20">
              <Shield className="h-4 w-4 text-cyan" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text">2. Sign Message</p>
              <p className="text-[10px] text-text-dim">Sign SIWE message to verify ownership</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/20">
              <Sparkles className="h-4 w-4 text-amber" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text">3. Get API Key</p>
              <p className="text-[10px] text-text-dim">Instantly receive your unique API key</p>
            </div>
          </div>
        </div>

        <ConnectButton />
      </div>
    )
  }

  // Connected but no API key yet
  if (isConnected && !apiKey) {
    return (
      <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-panel p-6">
        <div className="mb-6 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-cyan/20" />
            <Hexagon className="h-8 w-8 text-cyan" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-text">
            Ready to Get Your API Key
          </h2>
          <p className="mb-1 text-sm text-text-dim">
            Connected as
          </p>
          <p className="mono text-xs text-cyan">
            {`${address.slice(0, 6)}...${address.slice(-4)}`}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red/30 bg-red/10 p-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red" />
            <p className="text-xs text-red">{error}</p>
          </div>
        )}

        <div className="mb-4 rounded-lg border border-border bg-surface/50 p-4">
          <p className="mb-2 text-xs font-semibold text-text-dim uppercase tracking-wider">
            Message to Sign
          </p>
          <p className="text-sm text-text">
            Sign in to OMA AI to generate your API key for accessing AI inference services.
          </p>
        </div>

        <button
          onClick={handleSignAndGetKey}
          disabled={signing || isSigning}
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          {signing || isSigning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Sign & Get API Key
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[10px] text-text-dim">
          Your signature verifies wallet ownership without revealing sensitive data.
        </p>
      </div>
    )
  }

  // Has API key
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-green/30 bg-green/5 p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green/20">
          <Check className="h-8 w-8 text-green" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-text">
          API Key Generated
        </h2>
        <p className="text-sm text-text-dim">
          Your key is ready. Copy it now - it won&apos;t be shown again.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-green/30 bg-panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-text-dim uppercase tracking-wider">
            Your API Key
          </p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-xs text-text transition-colors hover:bg-border"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green" />
                <span className="text-green">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
        <p className="mono break-all text-sm text-cyan">
          {apiKey}
        </p>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/10 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber" />
        <p className="text-xs text-amber">
          Store this key securely. It will only be displayed once. You can view it again in your dashboard.
        </p>
      </div>

      <a
        href="/dashboard"
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        View Dashboard
        <ExternalLink className="h-4 w-4" />
      </a>

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-text-dim">
        <Hexagon className="h-3 w-3 text-blue-400" />
        <span>Connected: {address.slice(0, 6)}...{address.slice(-4)}</span>
      </div>
    </div>
  )
}