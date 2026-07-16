"use client";

import { Calendar, Fingerprint, Shield } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import type { User } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { TwoFactorSection } from "./TwoFactorSection";

function authMethodLabel(
	authMethod: ReturnType<typeof useWallet>["authMethod"],
): string {
	switch (authMethod) {
		case "siwe":
			return "SIWE (EIP-4361) wallet auth";
		case "account-number":
			return "Account number";
		default:
			return "Not set";
	}
}

interface ProfileSectionProps {
	user: User | null;
	onUserChange?: (user: User) => void;
	onError?: (error: string) => void;
}

export function ProfileSection({
	user,
	onUserChange,
	onError,
}: ProfileSectionProps) {
	const { authMethod } = useWallet();

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
					<div className="text-sm text-text">{authMethodLabel(authMethod)}</div>
				</div>
			</div>

			<TwoFactorSection
				user={user}
				onUserChange={onUserChange ?? (() => {})}
				onError={onError ?? (() => {})}
			/>
		</div>
	);
}
