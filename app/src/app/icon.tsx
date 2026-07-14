import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "@/lib/brand";

export const runtime = "edge";
export const alt = "OMA · Open Model Access";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * App icon — open-gateway emerald mark (matches favicon.svg / OmaLogo).
 * Static assets: public/favicon.svg, public/logos/oma-icon-*.png
 */
export default function Icon() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: BRAND_COLORS.void,
					borderRadius: 8,
					border: `1px solid ${BRAND_COLORS.panel}`,
					position: "relative",
				}}
			>
				{/* Signal bars */}
				<div
					style={{
						display: "flex",
						alignItems: "flex-end",
						gap: 2.5,
						height: 15,
						marginTop: 2,
					}}
				>
					<div
						style={{
							width: 3.2,
							height: 6,
							background: BRAND_COLORS.accent,
							borderRadius: 2,
							opacity: 0.7,
						}}
					/>
					<div
						style={{
							width: 3.2,
							height: 10,
							background: BRAND_COLORS.accent,
							borderRadius: 2,
							opacity: 0.88,
						}}
					/>
					<div
						style={{
							width: 3.2,
							height: 14,
							background: BRAND_COLORS.accent,
							borderRadius: 2,
						}}
					/>
				</div>
				{/* Status LED */}
				<div
					style={{
						position: "absolute",
						top: 5,
						right: 5,
						width: 4,
						height: 4,
						borderRadius: 999,
						background: BRAND_COLORS.accent,
					}}
				/>
			</div>
		),
		{ ...size },
	);
}
