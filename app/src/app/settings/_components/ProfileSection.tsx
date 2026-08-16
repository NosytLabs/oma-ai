"use client";

import { Calendar, Check, Copy, Fingerprint, Loader2, Mail, Shield, UserRound, Wallet } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import type { BetterAuthUser } from "@/lib/hooks/useAuth";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";
import { formatAddress, formatDateTime } from "@/lib/utils";

interface ProfileSectionProps {
	user: BetterAuthUser | null;
	evmAddress?: string | null;
}

function authMethodLabel(
	user: BetterAuthUser | null,
	evmAddress: string | null,
): string {
	if (evmAddress) return "Wallet (SIWE / EIP-4361)";
	if (user?.isAnonymous) return "Guest session";
	if (user?.emailVerified) return "Magic-link email";
	if (user?.email) return "Email";
	return "Not set";
}

export function ProfileSection({ user, evmAddress }: ProfileSectionProps) {
	const toast = useToast();
	const linkedWallet = evmAddress ?? user?.evmAddress ?? null;
	const [soundOn, setSoundOn] = useState(() => {
		if (typeof window === "undefined") return true;
		return isSoundEnabled();
	});
	const [copied, setCopied] = useState(false);
	const [displayName, setDisplayName] = useState(user?.name ?? "");
	const [savingName, setSavingName] = useState(false);
	const nameDirty = displayName.trim() !== (user?.name ?? "").trim();

	const handleSoundToggle = (checked: boolean) => {
		setSoundEnabled(checked);
		setSoundOn(checked);
	};

	const handleSaveName = async () => {
		const next = displayName.trim();
		if (!next || next.length > 64 || savingName) return;
		setSavingName(true);
		try {
			const { error } = await authClient.updateUser({ name: next });
			if (error) throw new Error(error.message || "Could not update name");
			toast.success("Display name saved");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not update name");
		} finally {
			setSavingName(false);
		}
	};

	const handleCopyId = async () => {
		if (!user?.id) return;
		try {
			await navigator.clipboard.writeText(user.id);
			setCopied(true);
			toast.success("User ID copied");
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			toast.error("Could not copy user ID");
		}
	};

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-text-bright">Profile</h2>
				<p className="mt-1 text-sm text-text-muted">
					Your account details and authentication method.
				</p>
			</div>

			<div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5">
				<div className="flex items-center gap-2 text-sm font-semibold text-text-bright">
					<UserRound className="h-4 w-4" aria-hidden="true" />
					Display name
				</div>
				<p className="mt-1 text-xs text-text-muted">
					Shown on receipts, exports, and the operator console. 1–64 characters.
				</p>
				<div className="mt-3 flex flex-col gap-2 sm:flex-row">
					<input
						type="text"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value.slice(0, 64))}
						onKeyDown={(e) => {
							if (e.key === "Enter") void handleSaveName();
						}}
						maxLength={64}
						autoComplete="nickname"
						aria-label="Display name"
						placeholder="Your name"
						className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-void)] px-3 text-sm text-text-bright placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
					/>
					<button
						type="button"
						onClick={() => void handleSaveName()}
						disabled={!nameDirty || displayName.trim().length === 0 || savingName}
						className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent/40 bg-accent px-4 text-xs font-semibold text-void transition-[background-color,transform,opacity] duration-200 ease-out hover:bg-accent-bright active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
					>
						{savingName ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						) : null}
						{savingName ? "Saving…" : "Save name"}
					</button>
				</div>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 transition-[border-color,background-color,transform] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] hover:scale-[1.01] duration-200 ease-out">
					<div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						<Fingerprint className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						User ID
					</div>
					<div className="mt-1 flex items-start justify-between gap-2">
						<div className="break-all font-mono text-[13px] text-text-bright font-medium tabular-nums">
							{user?.id || "—"}
						</div>
						{user?.id && (
							<button
								type="button"
								onClick={handleCopyId}
								className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-[color,background-color,transform] duration-200 ease-out hover:bg-surface hover:text-text-bright active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								aria-label={copied ? "User ID copied" : "Copy user ID"}
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
								) : (
									<Copy className="h-3.5 w-3.5" aria-hidden="true" />
								)}
							</button>
						)}
					</div>
				</div>
				<div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 transition-[border-color,background-color,transform] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] hover:scale-[1.01] duration-200 ease-out">
					<div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						<Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						Account created
					</div>
					<div className="mt-1 text-[13px] text-text-bright font-medium tabular-nums">
						{user?.createdAt ? formatDateTime(new Date(user.createdAt).toISOString()) : "—"}
					</div>
				</div>
				<div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 transition-[border-color,background-color,transform] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] hover:scale-[1.01] duration-200 ease-out">
					<div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						<Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						Authentication
					</div>
					<div className="mt-1 text-[13px] text-text-bright font-medium">
						{authMethodLabel(user, linkedWallet)}
					</div>
				</div>
			</div>

			{user?.email && (
				<div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 transition-[border-color,background-color] duration-200 ease-out hover:border-[var(--color-accent)]/40">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2 text-sm font-semibold text-text-bright">
								<Mail className="h-4 w-4" aria-hidden="true" />
								Email
							</div>
							<div className="mt-1 text-xs text-text-muted">
								{user.emailVerified ? "Verified magic-link address" : "Sign-in email"}
							</div>
						</div>
						<div className="min-w-0 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-[11px] text-text-bright">
							{user.email}
						</div>
					</div>
				</div>
			)}

			{linkedWallet && (
				<div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 transition-[border-color,background-color,transform] duration-200 ease-out hover:border-[var(--color-accent)]/40 hover:scale-[1.01]">
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
						<div className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-accent)]/20 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] px-3 py-1.5 font-mono text-[11px] text-[var(--color-accent)] font-medium tabular-nums">
							{formatAddress(linkedWallet)}
						</div>
					</div>
				</div>
			)}

			<div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 transition-colors duration-200 ease-out hover:border-[var(--color-accent)]/40 hover:scale-[1.01]">
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<div className="text-sm font-semibold text-text-bright">
							Sound cues
						</div>
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
						<div className="h-6 w-11 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-[border-color,background-color] peer-checked:border-[var(--color-accent)] peer-checked:bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] focus-within:ring-2 focus-within:ring-accent" />
						<div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-text-muted transition-transform duration-200 ease-out peer-checked:translate-x-5 peer-checked:bg-[var(--color-accent)]" />
					</label>
				</div>
			</div>
		</div>
	);
}
