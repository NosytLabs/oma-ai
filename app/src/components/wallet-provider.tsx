'use client'

import React, { useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { base } from 'wagmi/chains'
import { getWagmiConfigSingleton } from '@/lib/wagmi'
import { api, type User } from '@/lib/api'
import { WalletContext, type AuthMethod, type WalletKind } from './wallet-context'

export type { AuthMethod, WalletKind }

const noopSolana = {
  address: null as string | null,
  connected: false,
  connecting: false,
  connect: () => {},
  disconnect: async () => {},
  signMessage: async (_message: string) => { throw new Error('Solana wallet not available'); },
};

function useIsMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

function setCookie(name: string, value: string, maxAgeDays: number) {
  const expires = new Date(Date.now() + maxAgeDays * 86400000).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict; Secure`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict; Secure`
}

interface StoredSession {
  token: string;
  authMethod: AuthMethod;
}

function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('oma_session');
    if (!token) return null;
    const meta = localStorage.getItem('oma_session_meta');
    if (meta) {
      return { token, authMethod: JSON.parse(meta).authMethod || 'siwe' };
    }
    return { token, authMethod: 'siwe' };
  } catch {
    return null;
  }
}

function storeSession(token: string, authMethod: AuthMethod) {
  localStorage.setItem('oma_session', token);
  localStorage.setItem('oma_session_meta', JSON.stringify({ authMethod }));
  setCookie('oma_session', token, 7);
}

function clearSession() {
  localStorage.removeItem('oma_session');
  localStorage.removeItem('oma_session_meta');
  deleteCookie('oma_session');
}

function InnerProvider({ children }: { children: ReactNode }) {
  const { address, isConnected: evmConnected, chainId, isConnecting: evmConnecting } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect: evmDisconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const solana = noopSolana

  const [session, setSession] = useState<StoredSession | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
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
    const config = getWagmiConfigSingleton()
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

        const message = `oma-ai.com wants you to sign in with your Ethereum account:\n${address}\n\nI accept the OMA Terms of Service\n\nURI: https://oma-ai.com\nVersion: 1\nChain ID: ${base.id}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`

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

  useEffect(() => {
    if (solana.connected && solana.address && !session) {
      let cancelled = false;

      async function solanaLogin() {
        setIsAuthenticating(true);
        try {
          const challengeRes = await api.auth.solana.getChallenge(solana.address!);
          if (cancelled) return;

          const signature = await solana.signMessage(challengeRes.message);
          if (cancelled) return;

          const verifyRes = await api.auth.solana.verify(solana.address!, challengeRes.message, signature);
          if (cancelled) return;

          storeSession(verifyRes.token, 'solana');
          setSession({ token: verifyRes.token, authMethod: 'solana' });
          const userData = await api.auth.getUser();
          setUser(userData);
        } catch (err) {
          console.error('Solana login failed:', err);
        } finally {
          if (!cancelled) setIsAuthenticating(false);
        }
      }

      solanaLogin();

      return () => {
        cancelled = true;
      };
    }
  }, [solana.connected, solana.address, session, solana]);

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
    if (evmConnected) {
      evmDisconnect()
      siweDoneRef.current = undefined
    }
    if (solana.connected) {
      await solana.disconnect()
    }
    clearSession()
    setSession(null)
    setUser(null)
  }, [evmConnected, evmDisconnect, solana])

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (evmConnected) {
        try {
          const sig = await signMessageAsync({ message })
          return sig
        } catch (err) {
          console.error('SIWE sign failed:', err)
          throw new Error('Failed to sign message. Please try again.')
        }
      }
      if (solana.connected) {
        try {
          return await solana.signMessage(message)
        } catch (err) {
          console.error('Solana sign failed:', err)
          throw new Error('Failed to sign message. Please try again.')
        }
      }
      throw new Error('No wallet connected. Please connect a wallet first.')
    },
    [evmConnected, signMessageAsync, solana],
  )

  const isConnected = evmConnected || solana.connected;
  const isConnecting = evmConnecting || solana.connecting || isAuthenticating;
  const authMethod = session?.authMethod ?? null;
  const accountNumber = user?.accountNumber ?? null;
  const activeWallet: WalletKind | null = evmConnected ? 'evm' : solana.connected ? 'solana' : null;

  const hasEvmWallet = !!evmConnected;
  const hasSolanaWallet = solana.connected && !!solana.address;
  const canDepositBase = !!evmConnected || !!accountNumber;
  const canDepositSolana = solana.connected || !!accountNumber;
  const canUseSwap = !!evmConnected;

  const value = useMemo(
    () => ({
      isReady,
      isConnected,
      isAuthenticated: !!session,
      authMethod,
      accountNumber,
      connectEvm,
      disconnect,
      evmAddress: address,
      evmChain,
      solanaAddress: solana.address,
      signMessage,
      isConnecting,
      isAuthenticating,
      availableConnectors,
      activeWallet,
      hasEvmWallet,
      hasSolanaWallet,
      canDepositBase,
      canDepositSolana,
      canUseSwap,
      refreshUser,
    }),
    [
      isReady, isConnected, session, authMethod, accountNumber, connectEvm, disconnect, address, evmChain, solana.address, signMessage, isConnecting, isAuthenticating, availableConnectors, activeWallet, hasEvmWallet, hasSolanaWallet, canDepositBase, canDepositSolana, canUseSwap, refreshUser,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const isMounted = useIsMounted()
  const config = getWagmiConfigSingleton()

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {isMounted ? <InnerProvider>{children}</InnerProvider> : null}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
