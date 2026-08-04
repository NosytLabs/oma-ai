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

			<div className="mt-6 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
				<div className="flex min-h-[5.5rem] flex-col gap-1 bg-void p-4">
					<div className="flex items-center gap-2 text-[11px] font-medium text-text-muted">
						<Fingerprint className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						User ID
					</div>
					<div className="break-all font-mono text-sm text-text">
						{user?.id || "—"}
					</div>
				</div>
				<div className="flex min-h-[5.5rem] flex-col gap-1 bg-void p-4">
					<div className="flex items-center gap-2 text-[11px] font-medium text-text-muted">
						<Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						Account created
					</div>
					<div className="text-sm text-text">
						{user?.createdAt ? formatDateTime(user.createdAt) : "—"}
					</div>
				</div>
				<div className="flex min-h-[5.5rem] flex-col gap-1 bg-void p-4">
					<div className="flex items-center gap-2 text-[11px] font-medium text-text-muted">
						<Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						Authentication
					</div>
					<div className="text-sm text-text">
						{authMethodLabel(user, linkedWallet)}
					</div>
				</div>
			</div>

			{linkedWallet && (
				<div className="mt-4 rounded-lg border border-border bg-void p-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2 text-sm font-medium text-text-bright">
								<Wallet className="h-3.5 w-3.5" aria-hidden="true" />
								Linked wallet
							</div>
							<div className="mt-0.5 text-xs text-text-muted">
								SIWE (EIP-4361) on Base mainnet. Funds stay in your wallet.
							</div>
						</div>
						<div className="shrink-0 font-mono text-xs text-accent">
							{formatAddress(linkedWallet)}
						</div>
					</div>
				</div>
			)}

			<div className="mt-6 rounded-lg border border-border bg-void p-4">
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<div className="text-sm font-medium text-text-bright">Sound cues</div>
						<div className="mt-0.5 text-xs text-text-muted">
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
						<div className="h-6 w-11 rounded-full bg-border transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
						<div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
					</label>
				</div>
			</div>
		</div>
	);
}
