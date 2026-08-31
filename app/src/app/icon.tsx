import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
	return new ImageResponse(
		(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					borderRadius: "6px",
					background: "#46d39a",
					color: "#07090a",
					fontSize: "22px",
					fontWeight: 700,
					fontFamily: "ui-sans-serif, system-ui",
				}}
			>
				O
			</div>
		),
		{ ...size },
	);
}