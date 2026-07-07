import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OMA · logo";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon / app icon.
 *
 * Renders the OMA wordmark on the graphite brand background using the
 * Edge runtime. The composition matches the inline navbar SVG (see
 * `OmaLogo`) so the icon and the in-page mark are visually identical.
 */
export default async function Icon() {
	return new ImageResponse(
		(
			<svg
				viewBox="0 0 40 40"
				width={32}
				height={32}
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect
					x={0.5}
					y={0.5}
					width={39}
					height={39}
					rx={6}
					fill="#0a0a0f"
					stroke="#27272a"
					strokeWidth={1}
				/>
				<line
					x1={8}
					y1={32}
					x2={28}
					y2={32}
					stroke="#3f3f46"
					strokeWidth={1}
					strokeLinecap="round"
				/>
				<line
					x1={8}
					y1={11}
					x2={8}
					y2={28}
					stroke="#10b981"
					strokeWidth={2.4}
					strokeLinecap="round"
				/>
				<line
					x1={16}
					y1={18}
					x2={16}
					y2={28}
					stroke="#10b981"
					strokeWidth={2.4}
					strokeLinecap="round"
					opacity={0.7}
				/>
				<line
					x1={24}
					y1={14}
					x2={24}
					y2={28}
					stroke="#10b981"
					strokeWidth={2.4}
					strokeLinecap="round"
					opacity={0.45}
				/>
				<line
					x1={8}
					y1={14}
					x2={24}
					y2={22}
					stroke="#10b981"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					opacity={0.85}
				/>
				<circle cx={32} cy={10} r={1.2} fill="#10b981" />
			</svg>
		),
		{ ...size },
	);
}