import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "OMA AI",
		short_name: "OMA",
		description: "Permissionless AI inference. Pay per request in USDC.",
		start_url: "/",
		display: "standalone",
		background_color: "#0a0a0f",
		theme_color: "#f97316",
		icons: [
			{
				src: "/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
			},
		],
	};
}
