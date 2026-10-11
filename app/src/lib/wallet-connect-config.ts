/** Reown project IDs are public, but placeholders must not enable a broken connector. */
export function walletConnectProjectId(): string | undefined {
	const value = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
	return value && /^[a-f0-9]{32}$/i.test(value) ? value : undefined;
}

// Explicit service origins from WalletConnect's CSP guide. Included only when configured.
export const WALLETCONNECT_CONNECT_ORIGINS = [
	"https://rpc.walletconnect.com", "https://rpc.walletconnect.org",
	"https://explorer-api.walletconnect.com", "https://explorer-api.walletconnect.org",
	"https://relay.walletconnect.com", "https://relay.walletconnect.org",
	"wss://relay.walletconnect.com", "wss://relay.walletconnect.org",
	"https://pulse.walletconnect.com", "https://pulse.walletconnect.org",
	"https://api.web3modal.com", "https://api.web3modal.org",
	"https://keys.walletconnect.com", "https://keys.walletconnect.org",
	"wss://www.walletlink.org",
];
export const WALLETCONNECT_FRAME_ORIGINS = [
	"https://verify.walletconnect.com", "https://verify.walletconnect.org",
	"https://secure.walletconnect.com", "https://secure.walletconnect.org",
];
