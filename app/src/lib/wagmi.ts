import { createConfig, http, createStorage } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { injected, coinbaseWallet } from 'wagmi/connectors'

const MAINNET_RPC_FALLBACK = 'https://mainnet.base.org'
const TESTNET_RPC_FALLBACK = 'https://sepolia.base.org'

const mainnetUrl =
  process.env.NEXT_PUBLIC_QUICKNODE_MAINNET_URL || MAINNET_RPC_FALLBACK
const testnetUrl =
  process.env.NEXT_PUBLIC_QUICKNODE_TESTNET_URL || TESTNET_RPC_FALLBACK

export function getWagmiConfig() {
  return createConfig({
    chains: [base, baseSepolia],
    connectors: [
      injected(),
      coinbaseWallet({ appName: 'OMA AI' }),
    ],
    transports: {
      [base.id]: http(mainnetUrl, {
        batch: { batchSize: 8, wait: 50 },
        retryCount: 3,
        retryDelay: 200,
      }),
      [baseSepolia.id]: http(testnetUrl, {
        batch: { batchSize: 8, wait: 50 },
        retryCount: 3,
        retryDelay: 200,
      }),
    },
    storage: createStorage({ storage: typeof window !== 'undefined' ? window.localStorage : undefined, key: 'wagmi' }),
  })
}

let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null

export function getWagmiConfigSingleton() {
  if (!wagmiConfigSingleton) {
    wagmiConfigSingleton = getWagmiConfig()
  }
  return wagmiConfigSingleton
}
