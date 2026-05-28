import { createConfig, http, createStorage } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { injected, coinbaseWallet } from 'wagmi/connectors'

export function getWagmiConfig() {
  return createConfig({
    chains: [base, baseSepolia],
    connectors: [
      injected(),
      coinbaseWallet({ appName: 'OMA AI' }),
    ],
    transports: {
      [base.id]: http(
        process.env.NEXT_PUBLIC_QUICKNODE_MAINNET_URL || undefined
      ),
      [baseSepolia.id]: http(
        process.env.NEXT_PUBLIC_QUICKNODE_TESTNET_URL || undefined
      ),
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
