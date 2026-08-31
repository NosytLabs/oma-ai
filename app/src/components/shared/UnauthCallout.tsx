"use client";

import { AlertTriangle, type LucideIcon, LogIn, Wallet } from "lucide-react";
import Link from "next/link";
import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";

export type UnauthCalloutVariant = "dashboard" | "settings" | "deposit";

interface UnauthCalloutProps {
	variant: UnauthCalloutVariant;
	/** Optional EVM address shown when a wallet is connected but session isn't established. */
	evmAddress?: string;
}

/**
 * Single source of truth for the "sign in to continue" card shown on
 * auth-gated routes (dashboard, settings, deposit, …). Replaces ~50 lines of
 * near-duplicated JSX in each page. Animates in with a soft spring; CTA
 * carries the user back to /login with a `next=` deep link so they land on
 * the original surface after auth.
 */
export function UnauthCallout({ variant, evmAddress }: UnauthCalloutProps) {
	const { heading, subheading, features, cta } = copy[variant];
	const HeadingIcon = features[0]?.icon ?? AlertTriangle;

	return (
		<div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-16">
			<h2 className="sr-only">{heading}</h2>
			<m.div
				className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] border border-accent/20 bg-accent/10"
				whileHover={{ scale: 1.05 }}
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={springs.tab}
			>
				<HeadingIcon
					className="h-7 w-7 text-accent"
					aria-hidden="true"
				/>
			</m.div>

			<p className="font-mono text-xs uppercase tracking-widest text-accent">
				Sign in required
			</p>
			<h1 className="text-center text-2xl font-bold tracking-tight text-text-bright sm:text-3xl">
				{heading}
			</h1>
			<p className="max-w-md text-center text-sm text-text-secondary">
				{subheading}
			</p>

			{features.length > 0 && (
				<ul className="mx-auto grid w-full max-w-xl grid-cols-1 gap-2 text-left sm:grid-cols-2">
					{features.map(({ icon: Icon, label, description }) => (
						<li
							key={label}
							className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-border bg-surface/50 px-3 py-2 text-xs transition-[border-color,background-color] hover:bg-surface"
						>
							<Icon
								className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted"
								aria-hidden="true"
							/>
							<div className="min-w-0">
								<div className="font-medium text-text">{label}</div>
								<div className="text-text-muted">{description}</div>
							</div>
						</li>
					))}
				</ul>
			)}

			<div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
				<Link
					href={`/login?next=/${variant}`}
					className="btn-mono btn-primary"
					aria-label={`Sign in to access ${variant}`}
				>
					<LogIn className="h-3.5 w-3.5" aria-hidden="true" />
					<span>Sign in</span>
				</Link>
				{cta && (
					<Link href={cta.href} className="btn-mono">
						<span>{cta.label}</span>
					</Link>
				)}
			</div>

			{evmAddress && (
				<p className="text-center text-[10px] font-mono text-text-muted">
					Connected wallet: {evmAddress}
				</p>
			)}
		</div>
	);
}

const copy: Record<
	UnauthCalloutVariant,
	{
		heading: string;
		subheading: string;
		features: Array<{
			icon: LucideIcon;
			label: string;
			description: string;
		}>;
		cta?: { label: string; href: string };
	}
> = {
	dashboard: {
		heading: "Keys, usage, credits",
		subheading:
			"Sign in to manage API keys, see live credit balance, and review inference usage.",
		features: [
			{
				icon: Wallet,
				label: "Credit balance",
				description: "Live USDC and card-funded balances",
			},
			{
				icon: AlertTriangle,
				label: "Usage charts",
				description: "Per-day, per-model, per-provider breakdown",
			},
		],
		cta: { label: "Deposit USDC", href: "/deposit" },
	},
	settings: {
		heading: "Manage your account",
		subheading:
			"Settings covers your profile, theme, sessions, and data controls.",
		features: [
			{
				icon: AlertTriangle,
				label: "Profile",
				description: "Account details",
			},
			{
				icon: AlertTriangle,
				label: "Appearance",
				description: "Accent theme",
			},
			{
				icon: AlertTriangle,
				label: "Sessions",
				description: "Active devices",
			},
			{
				icon: AlertTriangle,
				label: "Privacy",
				description: "Your data",
			},
		],
	},
	deposit: {
		heading: "Top up credits",
		subheading:
			"Sign in to fund your account with card or USDC on Base. x402 micropayments work without an account.",
		features: [
			{
				icon: Wallet,
				label: "Card or USDC",
				description: "Polar checkout or Base deposit",
			},
			{
				icon: AlertTriangle,
				label: "Credits never expire",
				description: "Use across every curated model",
			},
		],
	},
};