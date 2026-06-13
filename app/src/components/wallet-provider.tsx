'use client'

import React, { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { base } from 'wagmi/chains'
import { SiweMessage } from 'siwe'
import { getWagmiConfig } from '@/lib/wagmi'
import { api, type User } from "@/lib/api/index"
import { WalletContext, type AuthMethod, type WalletKind } from './wallet-context'

export type { AuthMethod } from './wallet-context'

function useIsMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}

function setCookie(name: string, value: string, maxAgeDays: number) {
  const expires = new Date(Date.now() + maxAgeDays * 86400000).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict; Secure`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict; Secure`
}

export const DEMO_COOKIE_NAME = 'oma-demo'

export function setDemoCookie() {
  if (typeof document === 'undefined') return
  setCookie(DEMO_COOKIE_NAME, '1', 7)
}

export function clearDemoCookie() {
  if (typeof document === 'undefined') return
  deleteCookie(DEMO_COOKIE_NAME)
}

interface StoredSession {
  token: string;
  authMethod: AuthMethod;
}

function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    // Read the non-HttpOnly meta cookie; never read the session token from
    // client-side storage. The HttpOnly session cookie is sent with every
    // same-origin request and verified by the server.
    const meta = getCookieValue('oma_session_meta');
    if (!meta) return null;
    const parsed = JSON.parse(meta) as { authMethod?: AuthMethod };
    return { token: '', authMethod: parsed.authMethod || 'siwe' };
  } catch {
    return null;
  }
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find(c => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function storeSession(token: string, authMethod: AuthMethod) {
  // The HttpOnly session cookie is set by the server in the auth response.
  // The client must NOT write the JWT to localStorage (XSS-readable).
  setCookie('oma_session_meta', JSON.stringify({ authMethod }), 7);
}

function clearSession() {
  // Clear the non-sensitive meta cookie; the HttpOnly session cookie is
  // cleared by the server on /auth/logout.
  deleteCookie('oma_session_meta');
}

function buildSiweMessage(address: string, nonce: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  let url: URL
  try {
    url = new URL(appUrl)
  } catch {
    url = new URL('http://localhost:3000')
  }
  const siweMsg = new SiweMessage({
    domain: url.hostname,
    address,
    uri: url.origin,
    version: '1',
    chainId: base.id,
    nonce,
    statement: 'I accept the OMA Terms of Service',
    issuedAt: new Date().toISOString(),
  })
  return siweMsg.toMessage()
}

function InnerProvider({ children }: { children: ReactNode }) {
  const { address, isConnected: evmConnected, chainId, isConnecting: evmConnecting } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect: evmDisconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const [session, setSession] = useState<StoredSession | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  // Demo mode is set by middleware when the user lands on /dashboard?demo=1.
  // It is a preview-only path: the user is treated as "connected + authenticated"
  // so the dashboard renders, but the page gates its queries on `!isDemo` so no
  // real backend calls are made.
  const [isDemo, setIsDemo] = useState(false)
  const siweDoneRef = useRef<`0x${string}` | undefined>(undefined)

  const availableConnectors = useMemo(
    () =>
      connectors.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
      })),
    [connectors],
  )

  const evmChain = useMemo(() => {
    if (!chainId) return undefined
    const config = getWagmiConfig()
    const found = config.chains.find((c) => c.id === chainId)
    return found ? { id: found.id, name: found.name } : undefined
  }, [chainId])

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.auth.getUser();
      setUser(userData);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const hasDemoCookie =
      typeof document !== 'undefined' &&
      document.cookie.split('; ').some((c) => c.startsWith('oma-demo='))
    if (hasDemoCookie) setIsDemo(true)

    const stored = getStoredSession();
    if (stored) {
      setSession(stored);
      api.auth.getUser().then(setUser).catch(() => {
        clearSession();
        setSession(null);
      });
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!evmConnected || !address || siweDoneRef.current === address || isAuthenticating) return

    let cancelled = false

    async function siweLogin() {
      setIsAuthenticating(true)
      try {
        const nonceRes = await api.auth.getNonce(address!)
        const nonce = nonceRes.nonce

        const message = buildSiweMessage(address!, nonce)

        const signature = await signMessageAsync({ message })

        if (cancelled) return

        const verifyRes = await api.auth.verify(message, signature, 'siwe')

        if (cancelled) return

        if (verifyRes.token) {
          storeSession(verifyRes.token, 'siwe');
          setSession({ token: verifyRes.token, authMethod: 'siwe' });
          siweDoneRef.current = address;
          const userData = await api.auth.getUser();
          setUser(userData);
        }
      } catch (err: unknown) {
        console.error('SIWE login failed:', err)
        const error = err as { code?: number; message?: string }
        if (error.code === 4001 || error.message?.includes('User denied') || error.message?.includes('rejected')) {
          evmDisconnect()
        }
      } finally {
        if (!cancelled) setIsAuthenticating(false)
      }
    }

    siweLogin()

    return () => {
      cancelled = true
    }
  }, [evmConnected, address, signMessageAsync, isAuthenticating, evmDisconnect])

  const connectEvm = useCallback(
    (connectorId?: string) => {
      const connector = connectorId
        ? connectors.find((c) => c.id === connectorId)
        : connectors[0]
      if (connector) {
        connect({ connector })
      }
    },
    [connect, connectors],
  )

  const disconnect = useCallback(async () => {
    if (isDemo) {
      clearDemoCookie()
      setIsDemo(false)
    }
    if (evmConnected) {
      evmDisconnect()
      siweDoneRef.current = undefined
    }
    clearSession()
    setSession(null)
    setUser(null)
  }, [isDemo, evmConnected, evmDisconnect])

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!evmConnected) {
        throw new Error('No wallet connected. Please connect a wallet first.')
      }
      try {
        const sig = await signMessageAsync({ message })
        return sig
      } catch (err) {
        console.error('SIWE sign failed:', err)
        throw new Error('Failed to sign message. Please try again.')
      }
    },
    [evmConnected, signMessageAsync],
  )

  const isConnected = evmConnected;
  const isConnecting = evmConnecting || isAuthenticating;
  const authMethod = session?.authMethod ?? null;
  const accountNumber = user?.accountNumber ?? null;
  const activeWallet: WalletKind | null = evmConnected ? 'evm' : null;

  const hasEvmWallet = !!evmConnected;
  const canDepositBase = !!evmConnected || !!accountNumber;
  const canUseSwap = !!evmConnected;

  const value = useMemo(
    () => ({
      isReady,
      isConnected: isDemo || isConnected,
      isAuthenticated: isDemo || !!session,
      isDemo,
      authMethod,
      accountNumber,
      connectEvm,
      disconnect,
      evmAddress: address,
      evmChain,
      signMessage,
      isConnecting,
      isAuthenticating,
      availableConnectors,
      activeWallet,
      hasEvmWallet,
      canDepositBase,
      canUseSwap,
      refreshUser,
    }),
    [
      isReady, isDemo, isConnected, session, authMethod, accountNumber, connectEvm, disconnect, address, evmChain, signMessage, isConnecting, isAuthenticating, availableConnectors, activeWallet, hasEvmWallet, canDepositBase, canUseSwap, refreshUser,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const isMounted = useIsMounted()
  const config = getWagmiConfig()

  return (
    <WagmiProvider config={config}>
      {isMounted ? <InnerProvider>{children}</InnerProvider> : children}
    </WagmiProvider>
  )
}

export { useWallet } from './wallet-context'
