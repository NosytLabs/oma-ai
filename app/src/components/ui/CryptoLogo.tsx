"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import {
	CRYPTO_LOGOS,
	getCryptoLogoUrl,
	hasCryptoLogo,
} from "@/lib/cryptoLogos";

export interface CryptoLogoProps {
	/** Cryptocurrency symbol (e.g., 'BTC', 'ETH', 'USDC') */
	symbol: string;
	/** Size in pixels (default: 32) */
	size?: number;
	/** Additional CSS classes */
	className?: string;
	/** Use SVG variant if available */
	useSvg?: boolean;
	/** Fallback element to show on error */
	fallback?: React.ReactNode;
	/** Show loading skeleton */
	loading?: boolean;
	/** Custom border radius */
	rounded?: boolean;
}

/**
 * CryptoLogo - Displays cryptocurrency logos with lazy loading and error handling
 *
 * Features:
 * - Lazy loading of images
 * - Automatic fallback chain (primary -> fallback -> unknown)
 * - Customizable sizing
 * - Loading states
 * - Consistent visual styling
 */
export function CryptoLogo({
	symbol,
	size = 32,
	className = "",
	// Default to the SVGs bundled in /public/logos/ — the CoinGecko CDN is
	// only a fallback for symbols we don't ship locally.
	useSvg = true,
	fallback,
	loading = false,
	rounded = true,
}: CryptoLogoProps) {
	const [src, setSrc] = useState<string>("");
	const [error, setError] = useState(false);
	const [loaded, setLoaded] = useState(false);

	const normalizedSymbol = symbol.toUpperCase();

	// Determine image source URL
	useEffect(() => {
		if (hasCryptoLogo(normalizedSymbol)) {
			const url = getCryptoLogoUrl(normalizedSymbol, { useSvg });
			setSrc(url);
			setError(false);
			setLoaded(false);
		} else {
			// Unsupported symbol — no image source; the component renders the
			// text-initials fallback instead of depending on an external asset.
			setSrc("");
			setError(false);
			setLoaded(false);
		}
	}, [normalizedSymbol, useSvg]);

	// Preload image
	useEffect(() => {
		if (!src) return;

		const img = new Image();
		img.src = src;
		img.onload = () => setLoaded(true);
		img.onerror = () => {
			// Try fallback URL on error
			if (!src.includes("/logos/")) {
				const config = CRYPTO_LOGOS[normalizedSymbol];
				if (config?.fallbackUrl) {
					setSrc(config.fallbackUrl);
				}
			} else {
				setError(true);
			}
		};
	}, [src, normalizedSymbol]);

	const handleError = useCallback(() => {
		setError(true);
	}, []);

	const handleLoad = useCallback(() => {
		setLoaded(true);
	}, []);

	// Loading skeleton (only while a real image src is pending)
	if (loading || (src && !loaded)) {
		return (
			<div
				className={`flex-shrink-0 animate-pulse bg-surface ${className}`}
				style={{
					width: size,
					height: size,
					borderRadius: rounded ? "50%" : 4,
				}}
			/>
		);
	}

	// Error state with custom or default fallback
	if (error || !src) {
		if (fallback) {
			return (
				<div className={className} style={{ width: size, height: size }}>
					{fallback}
				</div>
			);
		}

		// Default text fallback showing symbol initials
		return (
			<div
				className={`flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-accent/20 to-blue-500/20 border border-accent/30 font-bold text-accent ${className}`}
				style={{
					width: size,
					height: size,
					fontSize: size * 0.35,
					borderRadius: rounded ? "50%" : 4,
				}}
			>
				{normalizedSymbol.slice(0, 2)}
			</div>
		);
	}

	// Local SVG logos
	if (src.startsWith("/")) {
		return (
			<div
				className={`flex-shrink-0 ${className}`}
				style={{
					width: size,
					height: size,
					borderRadius: rounded ? "50%" : 4,
				}}
			>
				<img
					src={src}
					alt={`${normalizedSymbol} logo`}
					className={`w-full h-full ${rounded ? "rounded-full" : "rounded"}`}
					style={{
						borderRadius: rounded ? "50%" : 4,
					}}
					onError={handleError}
					onLoad={handleLoad}
				/>
			</div>
		);
	}

	// External CDN logos
	return (
		<div
			className={`flex-shrink-0 overflow-hidden ${className}`}
			style={{
				width: size,
				height: size,
				borderRadius: rounded ? "50%" : 4,
			}}
		>
			<img
				src={src}
				alt={`${normalizedSymbol} logo`}
				className={`w-full h-full object-contain ${rounded ? "rounded-full" : "rounded"}`}
				style={{
					borderRadius: rounded ? "50%" : 4,
				}}
				onError={handleError}
				onLoad={handleLoad}
				loading="lazy"
			/>
		</div>
	);
}
