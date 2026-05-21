import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, coinbaseWallet } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export function getWagmiConfig() {
  return createConfig({
    chains: [base],
    connectors: [
      injected(),
      coinbaseWallet({ appName: 'OMA AI' }),
      ...(projectId ? [/* walletConnect({ projectId }) */] : []),
    ],
    transports: {
      [base.id]: http(),
    },
  })
}

let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null

export function getWagmiConfigSingleton() {
  if (!wagmiConfigSingleton) {
    wagmiConfigSingleton = getWagmiConfig()
  }
  return wagmiConfigSingleton
}
