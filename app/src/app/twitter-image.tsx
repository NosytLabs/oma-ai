import { ImageResponse } from "next/og";

export const alt = "OMA AI - Permissionless AI Inference";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function TwitterImage() {
	return new ImageResponse(
		<div
			style={{
				background:
					"linear-gradient(135deg, #0a0a0f 0%, #18181f 60%, #3d1505 100%)",
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 32,
				color: "#f5f5f4",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 24 }}>
				<div
					style={{
						width: 80,
						height: 80,
						borderRadius: 14,
						background: "#0a0a0f",
						border: "1px solid #2a2a35",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div
						style={{
							display: "flex",
							gap: 6,
							alignItems: "center",
							height: 50,
						}}
					>
						<div
							style={{
								width: 7,
								height: 18,
								background: "#f97316",
								borderRadius: 1.5,
							}}
						/>
						<div
							style={{
								width: 7,
								height: 38,
								background: "#f97316",
								borderRadius: 1.5,
							}}
						/>
						<div
							style={{
								width: 7,
								height: 50,
								background: "#f97316",
								borderRadius: 1.5,
							}}
						/>
						<div
							style={{
								width: 7,
								height: 28,
								background: "#f97316",
								borderRadius: 1.5,
							}}
						/>
					</div>
				</div>
				<div
					style={{
						fontSize: 88,
						fontWeight: 800,
						color: "#ffffff",
						letterSpacing: "-0.03em",
					}}
				>
					OMA
				</div>
			</div>
			<div style={{ fontSize: 32, color: "#f97316" }}>
				Permissionless AI inference
			</div>
		</div>,
		{ ...size },
	);
}
