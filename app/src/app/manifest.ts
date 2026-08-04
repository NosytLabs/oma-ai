import type { MetadataRoute } from "next";
import { BRAND_COLORS } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "OMA AI — Open Model Access",
		short_name: "OMA",
		description:
			"One gateway. Every model. No lock-in. OpenAI-compatible inference — card, USDC, or x402.",
		start_url: "/",
		display: "standalone",
		background_color: BRAND_COLORS.void,
		theme_color: BRAND_COLORS.void,
		icons: [
			{
				src: "/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
			{
				src: "/favicon-32x32.png",
				sizes: "32x32",
				type: "image/png",
			},
			{
				src: "/logos/oma-icon-192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/logos/oma-icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/logos/oma-icon-1024.png",
				sizes: "1024x1024",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/logos/oma-icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
		],
	};
}
