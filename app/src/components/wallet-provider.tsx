'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { base } from 'wagmi/chains'
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { getWagmiConfigSingleton } from '@/lib/wagmi'
import { api } from '@/lib/api'

// Prevent hydration mismatch by waiting for client-side mount
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
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
}

interface WalletContextValue {
  isConnected: boolean
  connectEvm: (connectorId?: string) => void
  disconnect: () => Promise<void>
  evmAddress: `0x${string}` | undefined
  evmChain: { id: number; name: string } | undefined
  signMessage: (message: string) => Promise<string>
  isConnecting: boolean
  availableConnectors: { id: string; name: string; icon?: string }[]
}

const WalletContext = createContext<WalletContextValue>({
  isConnected: false,
  connectEvm: () => {},
  disconnect: async () => {},
  evmAddress: undefined,
  evmChain: undefined,
  signMessage: async () => '',
  isConnecting: false,
  availableConnectors: [],
})

function InnerProvider({ children }: { children: ReactNode }) {
  const { address, isConnected: evmConnected, chainId, isConnecting: evmConnecting } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect: evmDisconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const [siweLoading, setSiweLoading] = useState(false)
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

  useEffect(() => {
    if (!evmConnected || !address || siweDoneRef.current === address || siweLoading) return

    let cancelled = false

    async function siweLogin() {
      setSiweLoading(true)
      try {
        const nonceRes = await api.auth.getNonce(address!)
        const nonce = nonceRes.nonce

        const message = `oma-ai.com wants you to sign in with your Ethereum account:\n${address}\n\nI accept the OMA Terms of Service\n\nURI: https://oma-ai.com\nVersion: 1\nChain ID: ${base.id}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`

        const signature = await signMessageAsync({ message })

        if (cancelled) return

        const verifyRes = await api.auth.verify(message, signature, 'siwe')

        if (cancelled) return

        if (verifyRes.token) {
          localStorage.setItem('oma_session', verifyRes.token)
          setCookie('oma_session', verifyRes.token, 7)
        }

        siweDoneRef.current = address
      } catch (err) {
        console.error('SIWE login failed:', err)
      } finally {
        if (!cancelled) setSiweLoading(false)
      }
    }

    siweLogin()

    return () => {
      cancelled = true
    }
  }, [evmConnected, address, signMessageAsync, siweLoading])

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
    localStorage.removeItem('oma_session')
    deleteCookie('oma_session')
  }, [evmConnected, evmDisconnect])

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
      throw new Error('No wallet connected. Please connect a wallet first.')
    },
    [evmConnected, signMessageAsync],
  )

  const isConnected = evmConnected
  const isConnecting = evmConnecting || siweLoading

  const value = useMemo(
    () => ({
      isConnected,
      connectEvm,
      disconnect,
      evmAddress: address,
      evmChain,
      signMessage,
      isConnecting,
      availableConnectors,
    }),
    [
      isConnected,
      connectEvm,
      disconnect,
      address,
      evmChain,
      signMessage,
      isConnecting,
      availableConnectors,
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
