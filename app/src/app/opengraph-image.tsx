import { ImageResponse } from "next/og";

// NOTE: this used to declare `runtime = "edge"`. The Satori + resvg bundle
// is ~1.07 MB, which is over Vercel Hobby's 1 MB Edge Function limit — the
// production deploy was REJECTED with "The Edge Function 'opengraph-image'
// size is 1.07 MB and your plan size limit is 1 MB." Node runtime is not
// subject to that cap, and the same works on a paid plan if you move back.
export const alt = "OMA — Open Model Access";
export const size = { width: 1280, height: 720 };
export const contentType = "image/png";

export default async function OpengraphImage({
	title = "OMA · Open Model Access",
	subtitle = "One API. Switch models freely. No lock-in.",
}: {
	title?: string;
	subtitle?: string;
}) {
	return new ImageResponse(
		(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "flex-start",
					justifyContent: "space-between",
					padding: "72px",
					background: "#07090a",
					color: "#f5f5f5",
					fontFamily: "ui-sans-serif, system-ui",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
					<div
						style={{
							width: "44px",
							height: "44px",
							borderRadius: "10px",
							background: "#46d39a",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#07090a",
							fontSize: "24px",
							fontWeight: 700,
						}}
					>
						O
					</div>
					<div style={{ fontSize: "22px", fontWeight: 600 }}>OMA</div>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
					<div
						style={{
							fontSize: "64px",
							fontWeight: 600,
							lineHeight: 1.05,
							letterSpacing: "-0.02em",
						}}
					>
						{title}
					</div>
					<div style={{ fontSize: "28px", color: "#9ca3af" }}>{subtitle}</div>
				</div>
				<div
					style={{
						display: "flex",
						gap: "32px",
						color: "#9ca3af",
						fontSize: "20px",
					}}
				>
					<span>OpenAI-compatible</span>
					<span>·</span>
					<span>USDC on Base</span>
					<span>·</span>
					<span>x402 settlement</span>
				</div>
			</div>
		),
		{ ...size },
	);
}