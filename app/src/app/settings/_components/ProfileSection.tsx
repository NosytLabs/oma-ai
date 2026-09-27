"use client";

import { Calendar, Check, Copy, Fingerprint, Loader2, Mail, Shield, UserRound, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import type { BetterAuthUser } from "@/lib/hooks/useAuth";
import { formatAddress, formatDateTime } from "@/lib/utils";
import { SettingsCard } from "./SettingsCard";

interface ProfileSectionProps {
	user: BetterAuthUser | null;
	evmAddress?: string | null;
	readOnly?: boolean;
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

export function ProfileSection({ user, evmAddress, readOnly = false }: ProfileSectionProps) {
	const toast = useToast();
	const linkedWallet = evmAddress ?? user?.evmAddress ?? null;
	const [copied, setCopied] = useState(false);
	const [displayName, setDisplayName] = useState(user?.name ?? "");
	const [savedName, setSavedName] = useState(user?.name ?? "");
	const [savingName, setSavingName] = useState(false);
	const nameDirty = displayName.trim() !== savedName.trim();

	useEffect(() => {
		const next = user?.name ?? "";
		setDisplayName(next);
		setSavedName(next);
	}, [user?.id, user?.name]);

	const handleSaveName = async () => {
		const next = displayName.trim();
		if (readOnly || !nameDirty || !next || next.length > 64 || savingName) return;
		setSavingName(true);
		try {
			const { error } = await authClient.updateUser({ name: next });
			if (error) throw new Error(error.message || "Could not update name");
			setDisplayName(next);
			setSavedName(next);
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

	const userIdAction = user?.id ? (
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
	) : null;

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-text-bright">Profile</h2>
				<p className="mt-1 text-sm text-text-muted">
					Your account details and authentication method.
				</p>
			</div>

			<SettingsCard
				icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
				title="Display name"
				description="Your account display name. 1–64 characters."
			>
				<div className="flex flex-col gap-2 sm:flex-row">
					<input
						type="text"
						value={displayName}
						disabled={readOnly || savingName}
						onChange={(e) => setDisplayName(e.target.value.slice(0, 64))}
						onKeyDown={(e) => {
							if (e.key === "Enter") void handleSaveName();
						}}
						maxLength={64}
						autoComplete="nickname"
						aria-label="Display name"
						placeholder="Your name"
						className="min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 text-sm text-text-bright placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
					/>
					<button
						type="button"
						onClick={() => void handleSaveName()}
						disabled={readOnly || !nameDirty || displayName.trim().length === 0 || savingName}
						className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent/40 bg-accent px-4 text-xs font-semibold text-void transition-[background-color,transform,opacity] duration-200 ease-out hover:bg-accent-bright active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
					>
						{savingName ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						) : null}
						{savingName ? "Saving…" : "Save name"}
					</button>
				</div>
			</SettingsCard>

			<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<SettingsCard
					variant="stat"
					icon={<Fingerprint className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
					title="User ID"
					action={userIdAction}
				>
					<div className="break-all font-mono text-[13px] text-text-bright font-medium tabular-nums">
						{user?.id || "—"}
					</div>
				</SettingsCard>
				<SettingsCard
					variant="stat"
					icon={<Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
					title="Account created"
				>
					<div className="text-[13px] text-text-bright font-medium tabular-nums">
						{user?.createdAt ? formatDateTime(new Date(user.createdAt).toISOString()) : "—"}
					</div>
				</SettingsCard>
				<SettingsCard
					variant="stat"
					icon={<Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
					title="Authentication"
				>
					<div className="text-[13px] text-text-bright font-medium">
						{authMethodLabel(user, linkedWallet)}
					</div>
				</SettingsCard>
			</div>

			{user?.email && (
				<SettingsCard
					className="mt-6"
					icon={<Mail className="h-4 w-4" aria-hidden="true" />}
					title="Email"
					description={user.emailVerified ? "Verified magic-link address" : "Sign-in email"}
				>
					<div className="min-w-0 break-all rounded-[var(--radius-md)] border border-border bg-surface px-3 py-1.5 font-mono text-[11px] text-text-bright">
						{user.email}
					</div>
				</SettingsCard>
			)}

			{linkedWallet && (
				<SettingsCard
					className="mt-6"
					icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
					title="Linked wallet"
					description="SIWE (EIP-4361) on Base mainnet. Funds stay in your wallet."
				>
					<div className="shrink-0 rounded-[var(--radius-md)] border border-accent/20 bg-accent/10 px-3 py-1.5 font-mono text-[11px] text-accent font-medium tabular-nums">
						{formatAddress(linkedWallet)}
					</div>
				</SettingsCard>
			)}
		</div>
	);
}
