"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	AlertTriangle,
	Clock,
	Key as KeyIcon,
	Loader2,
	Trash2,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { ApiKey } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface ApiKeysSectionProps {
	apiKeys: ApiKey[];
	onCopy: (text: string, id: string) => void;
	copied: string | null;
	onRevokeKey?: (keyId: string) => Promise<void>;
}

export function ApiKeysSection({
	apiKeys,
	onCopy,
	copied,
	onRevokeKey,
}: ApiKeysSectionProps) {
	const toast = useToast();
	const [confirmKeyId, setConfirmKeyId] = useState<string | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);

	const keyToRevoke = apiKeys.find((k) => k.id === confirmKeyId);
	const revokeTrapRef = useRef<HTMLDivElement>(null);
	useFocusTrap({ active: !!confirmKeyId && !!keyToRevoke, containerRef: revokeTrapRef });
	const primaryKey = apiKeys[0];

	const handleConfirmRevoke = async () => {
		if (!confirmKeyId || !onRevokeKey) return;
		setRevokingId(confirmKeyId);
		try {
			await onRevokeKey(confirmKeyId);
			toast.success("API key revoked");
			setConfirmKeyId(null);
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : "Failed to revoke key");
		} finally {
			setRevokingId(null);
		}
	};

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-text-bright">API keys</h2>
				<p className="mt-1 text-sm text-text-muted">
					Use these keys to call the OMA gateway programmatically. Keep them
					secret. Manage create / revoke on the dashboard for rate limits.
				</p>
			</div>

			<div className="mt-6 space-y-2">
				{apiKeys.length === 0 ? (
					<div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
						<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface">
							<KeyIcon className="h-4 w-4 text-text-muted" aria-hidden="true" />
						</div>
						<p className="text-sm text-text-bright">No API keys yet</p>
						<p className="mt-1 text-xs text-text-muted">
							Your first key is generated automatically when you sign in.
						</p>
					</div>
				) : (
					apiKeys.map((key, index) => (
						<div
							key={key.id}
							className="flex items-center gap-3 rounded-lg border border-border bg-void px-4 py-3 transition-colors hover:bg-surface"
						>
							<KeyIcon
								className="h-4 w-4 shrink-0 text-text-muted"
								aria-hidden="true"
							/>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-semibold text-text">
										{key.name}
									</span>
									{index === 0 && (
										<span className="inline-flex items-center gap-1 rounded-full bg-blue/10 px-2 py-0.5 text-[10px] font-medium text-blue">
											Primary
										</span>
									)}
								</div>
								<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
									<span className="font-mono">{key.prefix ? `${key.prefix}***` : "••••***"}</span>
									<span className="flex items-center gap-1">
										<Clock className="h-2.5 w-2.5" aria-hidden="true" />
										{formatDateTime(key.createdAt)}
									</span>
									{key.lastUsedAt && (
										<span>Last used {formatDateTime(key.lastUsedAt)}</span>
									)}
								</div>
							</div>
							<button
								type="button"
								onClick={() => onCopy(key.prefix, key.id)}
								aria-label="Copy API key prefix"
								className="rounded-md p-2 text-[11px] font-medium text-text-muted transition-colors hover:bg-surface hover:text-accent"
							>
								{copied === key.id ? "Copied" : "Copy"}
							</button>
							{onRevokeKey && (
								<button
									type="button"
									onClick={() => setConfirmKeyId(key.id)}
									disabled={revokingId !== null || confirmKeyId !== null}
									aria-label={`Revoke ${key.name}`}
									className="rounded-md p-2 text-[11px] font-medium text-text-muted transition-colors hover:bg-error/10 hover:text-error disabled:opacity-40"
								>
									{revokingId === key.id ? (
										<Loader2 className="h-3 w-3 animate-spin" />
									) : (
										"Revoke"
									)}
								</button>
							)}
						</div>
					))
				)}
			</div>

			{primaryKey && (
				<div className="mt-6 rounded-lg border border-accent/20 bg-accent/5 p-4">
					<div className="text-[11px] font-medium text-accent">
						Need a new key?
					</div>
					<p className="mt-1 text-xs text-text-secondary">
						Create additional keys from the dashboard with custom rate limits
						and expiry dates.
					</p>
					<a
						href="/dashboard?tab=api-keys"
						className="mt-2 inline-block text-xs font-medium text-accent hover:text-accent/80"
					>
						Open dashboard → API keys →
					</a>
				</div>
			)}

			{/* Revoke confirmation modal */}
			<AnimatePresence>
				{confirmKeyId && keyToRevoke && (
					<m.div
						ref={revokeTrapRef}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="settings-revoke-dialog-title"
						aria-describedby="settings-revoke-dialog-description"
						className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm p-4"
					>
						<m.div
							initial={{ scale: 0.95, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.95, opacity: 0 }}
							className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl"
						>
							<div className="mb-3 flex items-center gap-2">
								<div className="flex h-9 w-9 items-center justify-center rounded-full border border-error/30 bg-error/10 text-error">
									<AlertTriangle className="h-4 w-4" aria-hidden="true" />
								</div>
								<h3
									id="settings-revoke-dialog-title"
									className="text-sm font-semibold text-error"
								>
									Revoke this API key?
								</h3>
								<button
									type="button"
									onClick={() => setConfirmKeyId(null)}
									className="ml-auto rounded p-1 text-text-muted hover:bg-surface hover:text-text"
									aria-label="Cancel"
								>
									<X className="h-3.5 w-3.5" />
								</button>
							</div>
							<p
								id="settings-revoke-dialog-description"
								className="mb-5 text-sm text-text-secondary"
							>
								You are about to revoke{" "}
								<span className="font-medium text-text">
									{keyToRevoke.name}
								</span>
								. This action cannot be undone — any applications using this key
								will immediately lose access.
							</p>
							<div className="flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setConfirmKeyId(null)}
									disabled={revokingId !== null}
									autoFocus
									className="rounded-md border border-border bg-transparent px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text-secondary disabled:opacity-40"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleConfirmRevoke}
									disabled={revokingId !== null}
									className="inline-flex items-center gap-1.5 rounded-md border border-error bg-error/10 px-4 py-2 text-xs font-medium text-error transition-colors hover:bg-error/20 disabled:opacity-40"
								>
									{revokingId ? (
										<>
											<Loader2 className="h-3 w-3 animate-spin" />
											Revoking…
										</>
									) : (
										<>
											<Trash2 className="h-3 w-3" />
											Revoke key
										</>
									)}
								</button>
							</div>
						</m.div>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}
