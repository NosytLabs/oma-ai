/**
 * OMA AI — Web3ConfigProvider config
 *
 * Wires @ant-design/web3-ethers' EthersWeb3ConfigProvider with the chain set
 * and wallet factories used across the app. Reuses the chain metadata from
 * @/lib/wagmi so we don't drift between the legacy wagmi config and the new
 * web3.antd config.
 *
 * NOTE on wagmi v3 compat:
 *   @ant-design/web3 was authored against wagmi 2.x. The project is on wagmi
 *   3.5.0. The ethers adapter's `wagimConfig` prop is structurally compatible
 *   at runtime (same shape: { connectors, chains, transports, ... }) but the
 *   v2/v3 type signatures differ. We construct the config through `as unknown`
 *   to satisfy both sides. Verified manually that wagmi 3 Config has the same
 *   keys web3.antd reads: chains, connectors, transports.
 */

import type { Chain as AntChain } from '@ant-design/web3-common'
import {
  MetaMask,
  CoinbaseWallet,
  TokenPocket,
  SafeheronWallet,
  UniversalWallet,
  OkxWallet,
  ImToken,
} from '@ant-design/web3-ethers'
import { getWagmiConfig } from '@/lib/wagmi'
import { api } from '@/lib/api'
import { mainnet, sepolia, base, baseSepolia } from 'wagmi/chains'

function buildWagmiConfigCompat(): unknown {
  return getWagmiConfig() as unknown
}

export const omaChains: AntChain[] = [
  { id: base.id, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
  { id: baseSepolia.id, name: 'Base Sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
  { id: mainnet.id, name: 'Ethereum', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
  { id: sepolia.id, name: 'Sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
]

export const omaWalletFactories = [
  MetaMask(),
  CoinbaseWallet(),
  TokenPocket(),
  OkxWallet(),
  ImToken(),
  SafeheronWallet(),
  new UniversalWallet({ name: 'Universal Wallet', remark: 'A universal wallet adapter' }),
]

export const omaSiweConfig = {
  getNonce: async (address: string) => {
    const res = await api.auth.getNonce(address)
    return res.nonce
  },
  createMessage: (args: { address: string; nonce: string; chainId?: number }) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let url: URL
    try {
      url = new URL(appUrl)
    } catch {
      url = new URL('http://localhost:3000')
    }
    const issuedAt = new Date().toISOString()
    return [
      `${url.hostname} wants you to sign in with your Ethereum account:`,
      args.address,
      '',
      'I accept the OMA Terms of Service',
      '',
      `URI: ${url.origin}`,
      'Version: 1',
      `Chain ID: ${args.chainId ?? 1}`,
      `Nonce: ${args.nonce}`,
      `Issued At: ${issuedAt}`,
    ].join('\n')
  },
  verifyMessage: async (message: string, signature: string) => {
    try {
      const res = await api.auth.verify(message, signature, 'siwe')
      return !!res.token
    } catch {
      return false
    }
  },
}

export const omaWeb3Config = {
  chainAssets: omaChains,
  walletFactories: omaWalletFactories,
  siwe: omaSiweConfig,
  ens: true,
  balance: true,
  wagimConfig: buildWagmiConfigCompat(),
}

export default omaWeb3Config
