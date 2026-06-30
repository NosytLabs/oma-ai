import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OMA AI";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#0a0a0f",
				color: "#f97316",
				fontSize: 22,
				fontWeight: 800,
				borderRadius: 6,
			}}
		>
			O
		</div>,
		{ ...size },
	);
}
