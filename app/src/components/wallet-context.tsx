"use client";

import { createContext, useContext } from "react";

export type AuthMethod = "siwe" | "account-number" | null;
export type WalletKind = "evm" | "account-number" | "none";

interface WalletContextValue {
	isReady: boolean;
	isConnected: boolean;
	isAuthenticated: boolean;
	/**
	 * C-C1: true when the user is browsing the dashboard under the 24h
	 * `oma-demo=1` cookie. The UI uses this to gate mutations, render mock
	 * data, and show a "Demo mode" banner. Demo mode is read-only — the
	 * server-side sessionAuth middleware never accepts the demo cookie as
	 * authentication, so any mutation call would 401.
	 */
	isDemo: boolean;
	authMethod: AuthMethod;
	accountNumber: string | null;
	connectEvm: (connectorId?: string) => void;
	disconnect: () => Promise<void>;
	evmAddress: `0x${string}` | undefined;
	evmChain: { id: number; name: string } | undefined;
	signMessage: (message: string) => Promise<string>;
	isConnecting: boolean;
	isAuthenticating: boolean;
	availableConnectors: { id: string; name: string; icon?: string }[];
	activeWallet: WalletKind;
	hasEvmWallet: boolean;
	canDepositBase: boolean;
	canUseSwap: boolean;
	refreshUser: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextValue>({
	isReady: false,
	isConnected: false,
	isAuthenticated: false,
	isDemo: false,
	authMethod: null,
	accountNumber: null,
	connectEvm: () => {},
	disconnect: async () => {},
	evmAddress: undefined,
	evmChain: undefined,
	signMessage: async (_message: string) => "",
	isConnecting: false,
	isAuthenticating: false,
	availableConnectors: [],
	activeWallet: "none",
	hasEvmWallet: false,
	canDepositBase: false,
	canUseSwap: false,
	refreshUser: async () => {},
});

export function useWallet() {
	return useContext(WalletContext);
}

export type { WalletContextValue };
