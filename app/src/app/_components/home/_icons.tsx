/**
 * Brand logos — monochrome inline SVGs for the trust strip.
 * Each <svg> includes a <title> for screen-reader accessibility per
 * WAI-ARIA SVG conventions.
 */

import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "title"> & {
	title: string;
};

function wrap({
	title,
	children,
	...rest
}: IconProps & { children: ReactNode }) {
	return (
		<svg
			fill="currentColor"
			role="img"
			focusable="false"
			{...rest}
		>
			<title>{title}</title>
			{children}
		</svg>
	);
}

function OpenAILogo(props: IconProps) {
	return wrap({
		...props,
		viewBox: "0 0 24 24",
		children: (
			<path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.052 6.052 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.787a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.685zm2.01-3.013l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.682 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
		),
	});
}

function AnthropicLogo(props: IconProps) {
	return wrap({
		...props,
		viewBox: "0 0 24 24",
		children: (
			<path d="M12 2L2 19.5h3.5L12 6l6.5 13.5H22L12 2zm0 7l-4 8h8l-4-8z" />
		),
	});
}

function BaseLogo(props: IconProps) {
	return wrap({
		...props,
		viewBox: "0 0 24 24",
		children: (
			<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 5.93 13.31l-2.13-3.69a3.5 3.5 0 1 0-3.6 0L10.07 17.3A8 8 0 0 1 12 4zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
		),
	});
}

function UsdcLogo(props: IconProps) {
	return wrap({
		...props,
		viewBox: "0 0 24 24",
		children: (
			<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm.5-13H11a2 2 0 0 0-2 2v.5a2 2 0 0 0 2 2h2a.5.5 0 0 1 0 1h-3v1h2v1h1v-1h.5a1.5 1.5 0 0 0 1.5-1.5v-.5a1.5 1.5 0 0 0-1.5-1.5h-2a.5.5 0 0 1 0-1h3V8h-2V7h-1v1z" />
		),
	});
}

function X402Logo(props: IconProps) {
	return wrap({
		...props,
		viewBox: "0 0 24 24",
		children: (
			<path d="M4 4h6v2H6v6H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z" />
		),
	});
}

function WalletLogo(props: IconProps) {
	return wrap({
		...props,
		viewBox: "0 0 24 24",
		children: (
			<path d="M21 7H5a1 1 0 0 1 0-2h13V3H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm-1 12H5a1 1 0 0 1-1-1V7.82A3 3 0 0 0 5 9h15v10zm-3-7h-2v2h2v-2z" />
		),
	});
}

export const TRUST_LOGOS = [
	{ name: "OpenAI", Component: OpenAILogo },
	{ name: "Anthropic", Component: AnthropicLogo },
	{ name: "Base", Component: BaseLogo },
	{ name: "USDC", Component: UsdcLogo },
	{ name: "x402", Component: X402Logo },
	{ name: "Wallet", Component: WalletLogo },
] as const;