"use client";

import { Calendar, Fingerprint, Shield, Wallet } from "lucide-react";
import { useState } from "react";
import type { User } from "@/lib/api";
import { formatDateTime, formatAddress } from "@/lib/utils";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";

interface ProfileSectionProps {
	user: User | null;
	evmAddress?: string | null;
	onUserChange?: (user: User) => void;
	onError?: (error: string) => void;
}

function authMethodLabel(user: User | null, evmAddress: string | null): string {
	if (evmAddress) return "Wallet (SIWE / EIP-4361)";
	if (user?.isAnonymous) return "Guest session";
	if (user?.emailVerified) return "Magic-link email";
	if (user?.email) return "Email";
	return "Not set";
}

export function ProfileSection({
	user,
	evmAddress,
}: ProfileSectionProps) {
	const linkedWallet = evmAddress ?? user?.evmAddress ?? null;
	const [soundOn, setSoundOn] = useState(() => {
		if (typeof window === "undefined") return true;
		return isSoundEnabled();
	});

	const handleSoundToggle = (checked: boolean) => {
		setSoundEnabled(checked);
		setSoundOn(checked);
	};

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-text-bright">Profile</h2>
				<p className="mt-1 text-sm text-text-muted">
					Your account details and authentication method.
				</p>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 transition-[border-color,background-color] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)]">
					<div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						<Fingerprint className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						User ID
					</div>
					<div className="mt-1 break-all font-mono text-[13px] text-text-bright font-medium">
						{user?.id || "—"}
					</div>
				</div>
				<div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 transition-[border-color,background-color] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)]">
					<div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						<Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						Account created
					</div>
					<div className="mt-1 text-[13px] text-text-bright font-medium">
						{user?.createdAt ? formatDateTime(user.createdAt) : "—"}
					</div>
				</div>
				<div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 transition-[border-color,background-color] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)]">
					<div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						<Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						Authentication
					</div>
					<div className="mt-1 text-[13px] text-text-bright font-medium">
						{authMethodLabel(user, linkedWallet)}
					</div>
				</div>
			</div>

			{linkedWallet && (
				<div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 transition-colors duration-200 ease-out hover:border-[var(--color-accent)]/40">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2 text-sm font-semibold text-text-bright">
								<Wallet className="h-4 w-4" aria-hidden="true" />
								Linked wallet
							</div>
							<div className="mt-1 text-xs text-text-muted">
								SIWE (EIP-4361) on Base mainnet. Funds stay in your wallet.
							</div>
						</div>
						<div className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-accent)]/20 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] px-3 py-1.5 font-mono text-[11px] text-[var(--color-accent)] font-medium">
							{formatAddress(linkedWallet)}
						</div>
					</div>
				</div>
			)}

			<div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 transition-colors duration-200 ease-out hover:border-[var(--color-accent)]/40">
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<div className="text-sm font-semibold text-text-bright">Sound cues</div>
						<div className="mt-1 text-xs text-text-muted">
							Subtle chime when a task succeeds or fails.
						</div>
					</div>
					<label className="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							className="peer sr-only"
							checked={soundOn}
							onChange={(e) => handleSoundToggle(e.target.checked)}
							aria-label="Toggle subtle success and failure sound cues"
						/>
						<div className="h-6 w-11 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-[border-color,background-color] peer-checked:border-[var(--color-accent)] peer-checked:bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)]" />
						<div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-text-muted transition-transform duration-200 ease-out peer-checked:translate-x-5 peer-checked:bg-[var(--color-accent)]" />
					</label>
				</div>
			</div>
		</div>
	);
}
