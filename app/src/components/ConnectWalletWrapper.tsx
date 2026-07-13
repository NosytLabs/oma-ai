"use client";

import { useEffect, useState } from "react";
import { WalletProvider } from "./wallet-provider";

/**
 * ConnectWalletWrapper
 *
 * The WalletProvider is a client component that mounts wagmi/react-query state.
 * We render it on the server too — wagmi is SSR-safe (its connector setup is
 * no-op until window.ethereum is read in InnerProvider). The previous
 * `next/dynamic({ ssr: false })` wrapping caused Next.js to bail out the
 * whole layout tree to client-side rendering on every page, which:
 *   - prevented server components in the page from streaming their content
 *     (home, login, pricing, docs all rendered empty shells);
 *   - produced a `BAILOUT_TO_CLIENT_SIDE_RENDERING` template in the SSR HTML
 *     and a noisy "1 Error" badge in the dev overlay.
 *
 * The mounted-state dance below preserves the original intent — don't run any
 * wallet logic until the browser is available — without forcing an SSR
 * bailout. InnerProvider already gates on `isMounted` itself.
 */
interface ConnectWalletWrapperProps {
	children: React.ReactNode;
}

export function ConnectWalletWrapper({ children }: ConnectWalletWrapperProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return <WalletProvider mounted={mounted}>{children}</WalletProvider>;
}
