"use client";

import { CreditCard, Wallet, Wifi } from "lucide-react";
import type { ConnectorKind, ConnectorView } from "./types";

/**
 * Inline-SVG wallet icons. The MetaMask glyph is a simplified rendition —
 * exact-photorealistic vectors would balloon the bundle for marginal gain
 * since these only appear in a small picker dropdown.
 */

function MetaMaskIcon() {
	return (
		<svg
			viewBox="0 0 32 32"
			width="20"
			height="20"
			aria-hidden="true"
			className="h-5 w-5"
		>
			<path
				d="M29 4 17.4 11.2l2.1-5.1z"
				fill="#E2761B"
				stroke="#E2761B"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="m3 4 11.5 7.3-2-5.2zM24.7 22.6l-3 4.7 6.5 1.8 1.9-6.3zM1.9 22.8l1.9 6.3 6.5-1.8-3-4.7z"
				fill="#E4761B"
				stroke="#E4761B"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="m10.3 14.4-1.8 2.8 6.5.3-.2-7zM21.7 14.4l-4.5-4 .1 7.1 6.5-.3zM10.3 27.3l4-1.9-3.4-2.7zM17.7 25.4l4 1.9-.6-4.6z"
				fill="#E4761B"
				stroke="#E4761B"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="m21.7 27.3-4-1.9.3 3.2zM10.3 27.3l3.7 1.3.3-3.2zM14.1 19.4l-3.3-1 2.3-1.1zM17.9 19.4l1-2.1 2.3 1.1z"
				fill="#D7C1B3"
				stroke="#D7C1B3"
				strokeLinejoin="round"
			/>
			<path
				d="m10.3 27.3.6-4.6-4.1.1zM21.1 22.7l.6 4.6 3.5-4.5zM27.5 17.2l-6.5.3.5 4.3 2.3-1.1 3.5-2.1.2-1.4z"
				fill="#233447"
				stroke="#233447"
				strokeLinejoin="round"
			/>
			<path
				d="M21 12.3l-6.5.3 1 4.8 1-2.1zM11 12.3l4.5 4 1-2.1 1-4.8zM21 12.3l-1 4.8 1.5 1.5 2.7-.2.4-3.5zM10.8 12.3l-3.6 2.6.4 3.5 2.7.2 1.5-1.5z"
				fill="#763D16"
				stroke="#763D16"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function CoinbaseIcon() {
	return (
		<svg
			viewBox="0 0 32 32"
			width="20"
			height="20"
			aria-hidden="true"
			className="h-5 w-5"
		>
			<circle cx="16" cy="16" r="14" fill="#1652F0" />
			<rect x="11" y="11" width="10" height="10" rx="5" fill="#ffffff" />
		</svg>
	);
}

function WalletConnectIcon() {
	return (
		<svg
			viewBox="0 0 32 32"
			width="20"
			height="20"
			aria-hidden="true"
			className="h-5 w-5"
		>
			<path
				d="M9.5 11.2c1.8-1.7 4.7-1.7 6.5 0L17.4 13l1.4-1.4c2.7-2.6 7.1-2.6 9.8 0l-1.5 1.4c-1.9-1.8-5-1.8-6.8 0L18.7 14.7l-1.4-1.4c-1-1-2.5-1-3.4 0L12.5 14.7l-1.5-1.5z"
				fill="#3B99FC"
			/>
			<path
				d="M5.3 16.7c2.7-2.6 7.1-2.6 9.8 0L16.7 18l-1.5 1.4c-1.9-1.8-5-1.8-6.8 0l-3.1-2.7z"
				fill="#F6A65A"
			/>
			<path
				d="M16 21.5l1.4-1.4 5.2 5-1.4 1.4zm-1.4-1.4l1.4-1.4 1.4 1.4-1.4 1.4z"
				fill="#F6A65A"
			/>
		</svg>
	);
}

/**
 * Resolve a connector `id`/`name` pair (as emitted by wagmi) to a
 * strongly-typed `ConnectorKind`. Centralizing this here keeps the
 * picker and `ImprovedConnectButton` aligned if a new connector appears.
 */
export function classifyConnector(id: string, name?: string): ConnectorKind {
	const lowerName = name?.toLowerCase() ?? "";
	if (
		lowerName.includes("metamask") ||
		id === "io.metamask" ||
		id === "metaMask"
	) {
		return "metamask";
	}
	if (id.includes("coinbase") || lowerName.includes("coinbase")) {
		return "coinbase";
	}
	if (id === "walletConnect" || lowerName.includes("walletconnect")) {
		return "walletconnect";
	}
	if (id === "injected") return "injected";
	return "unknown";
}

export function ConnectorIcon({
	connector,
	className,
}: {
	connector: ConnectorView;
	className?: string;
}) {
	const wrapperCls = `flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface shrink-0 ${className ?? ""}`;

	switch (connector.kind) {
		case "metamask":
			return (
				<div className={wrapperCls}>
					<MetaMaskIcon />
				</div>
			);
		case "coinbase":
			return (
				<div className={wrapperCls}>
					<CoinbaseIcon />
				</div>
			);
		case "walletconnect":
			return (
				<div className={wrapperCls}>
					<WalletConnectIcon />
				</div>
			);
		case "injected":
			return (
				<div className={wrapperCls}>
					<Wallet className="h-4 w-4 text-text-secondary" />
				</div>
			);
		default:
			// Fallback for `unknown` (catch-all): try to infer from id since
			// classifyConnector already ran.
			if (
				connector.id === "walletConnect" ||
				connector.id.includes("walletconnect")
			) {
				return (
					<div className={wrapperCls}>
						<Wifi className="h-4 w-4 text-text-secondary" />
					</div>
				);
			}
			if (connector.id.includes("coinbase")) {
				return (
					<div className={wrapperCls}>
						<CreditCard className="h-4 w-4 text-text-secondary" />
					</div>
				);
			}
			return (
				<div className={wrapperCls}>
					<Wallet className="h-4 w-4 text-text-secondary" />
				</div>
			);
	}
}
