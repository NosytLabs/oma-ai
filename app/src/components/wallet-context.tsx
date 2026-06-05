'use client'

import { createContext, useContext } from 'react'

export type AuthMethod = 'siwe' | 'solana' | 'account-number' | 'sso' | null;
export type WalletKind = 'evm' | 'solana' | 'account-number';

interface WalletContextValue {
  isReady: boolean;
  isConnected: boolean;
  isAuthenticated: boolean;
  authMethod: AuthMethod;
  accountNumber: string | null;
  connectEvm: (connectorId?: string) => void;
  disconnect: () => Promise<void>;
  evmAddress: `0x${string}` | undefined;
  evmChain: { id: number; name: string } | undefined;
  solanaAddress: string | null;
  signMessage: (message: string) => Promise<string>;
  isConnecting: boolean;
  isAuthenticating: boolean;
  availableConnectors: { id: string; name: string; icon?: string }[];
  activeWallet: WalletKind | null;
  hasEvmWallet: boolean;
  hasSolanaWallet: boolean;
  canDepositBase: boolean;
  canDepositSolana: boolean;
  canUseSwap: boolean;
  refreshUser: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextValue>({
  isReady: false,
  isConnected: false,
  isAuthenticated: false,
  authMethod: null,
  accountNumber: null,
  connectEvm: () => {},
  disconnect: async () => {},
  evmAddress: undefined,
  evmChain: undefined,
  solanaAddress: null,
  signMessage: async (_message: string) => '',
  isConnecting: false,
  isAuthenticating: false,
  availableConnectors: [],
  activeWallet: null,
  hasEvmWallet: false,
  hasSolanaWallet: false,
  canDepositBase: false,
  canDepositSolana: false,
  canUseSwap: false,
  refreshUser: async () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

export type { WalletContextValue }