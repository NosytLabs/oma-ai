import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon — open-gateway emerald mark.
 * Static high-res source: public/apple-touch-icon.png
 */
export default function AppleIcon() {
	return new ImageResponse(
		(
			<div
				style={{
					background: "#07090a",
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					borderRadius: 40,
					position: "relative",
				}}
			>
				<div
					style={{
						position: "absolute",
						width: 148,
						height: 148,
						borderRadius: 34,
						background: "#0f1512",
						border: "2px solid #1c2822",
						display: "flex",
					}}
				/>
				{/* Ring approximation */}
				<div
					style={{
						position: "absolute",
						width: 96,
						height: 96,
						borderRadius: 999,
						border: "6px solid #46d39a",
						display: "flex",
					}}
				/>
				<div
					style={{
						display: "flex",
						alignItems: "flex-end",
						gap: 10,
						height: 56,
						zIndex: 1,
					}}
				>
					<div
						style={{
							width: 12,
							height: 22,
							background: "#46d39a",
							borderRadius: 6,
							opacity: 0.7,
						}}
					/>
					<div
						style={{
							width: 12,
							height: 36,
							background: "#46d39a",
							borderRadius: 6,
							opacity: 0.88,
						}}
					/>
					<div
						style={{
							width: 12,
							height: 52,
							background: "#46d39a",
							borderRadius: 6,
						}}
					/>
				</div>
				<div
					style={{
						position: "absolute",
						top: 36,
						right: 40,
						width: 14,
						height: 14,
						borderRadius: 999,
						background: "#46d39a",
						boxShadow: "0 0 18px #46d39a",
					}}
				/>
			</div>
		),
		{ ...size },
	);
}
