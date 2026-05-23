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
      [base.id]: http(),
      [baseSepolia.id]: http(),
    },
    storage: createStorage({ storage: typeof window !== 'undefined' ? window.localStorage : undefined }),
  })
}

let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null

export function getWagmiConfigSingleton() {
  if (!wagmiConfigSingleton) {
    wagmiConfigSingleton = getWagmiConfig()
  }
  return wagmiConfigSingleton
}
