// Thin re-export so the navbar (and any other consumer) can keep its
// `import { Web3ConnectButton } from './web3'` import stable. The actual
// implementation lives in `ui/ImprovedConnectButton`; the audit (2026-06-17,
// C1) intended to consolidate the connect button surface here.
export { ImprovedConnectButton as Web3ConnectButton } from './ui/ImprovedConnectButton';
