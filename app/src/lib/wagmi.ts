import { createConfig, http, createStorage } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'

const MAINNET_RPC_FALLBACK = 'https://mainnet.base.org'
const TESTNET_RPC_FALLBACK = 'https://sepolia.base.org'

const mainnetUrl =
  process.env.NEXT_PUBLIC_QUICKNODE_MAINNET_URL || MAINNET_RPC_FALLBACK
// ponytail: dedicated Sepolia endpoint when set; otherwise reuse the mainnet URL
// (the QuickNode endpoint is multichain-flagged, but the X-QN-Network-Version
// header is not honored by the current endpoint — verified 2026-06-23 — so we
// fall back to public Sepolia RPC unless an operator provisions a dedicated
// Base Sepolia endpoint).
const testnetUrl =
  process.env.NEXT_PUBLIC_QUICKNODE_TESTNET_URL || TESTNET_RPC_FALLBACK

function getWagmiConfig() {
  const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

  // Reject known placeholder values so the app doesn't send 403-bound
  // requests to api.web3modal.org. A real project ID must be obtained from
  // https://cloud.walletconnect.com and set in .env.local.
  const WALLETCONNECT_PLACEHOLDER = 'your_walletconnect_project_id'
  const walletConnectProjectId =
    rawProjectId && rawProjectId !== WALLETCONNECT_PLACEHOLDER
      ? rawProjectId
      : undefined

  if (!walletConnectProjectId && rawProjectId) {
    console.warn(
      '[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set to the default placeholder. ' +
        'WalletConnect connector will not be registered. ' +
        'Get a free project ID at https://cloud.walletconnect.com',
    )
  }

  const connectors = [
    injected(),
    coinbaseWallet({ appName: 'OMA AI' }),
    // WalletConnect is only registered when a valid project ID is configured.
    // Without one, the connector would silently fail to initialize. Operators
    // can opt in by setting NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local.
    ...(walletConnectProjectId
      ? [walletConnect({ projectId: walletConnectProjectId, showQrModal: true })]
      : []),
  ]

  return createConfig({
    chains: [base, baseSepolia],
    connectors,
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
