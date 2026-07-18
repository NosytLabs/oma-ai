"use client";

import { memo, useState } from "react";
import type { ApiKey } from "@/lib/api";
import { maskKey } from "@/lib/utils";

interface ApiKeyManagerProps {
	keys: ApiKey[];
	loading: boolean;
	creating: boolean;
	showCreateForm: boolean;
	newKeyName: string;
	copied: string | null;
	revokingId: string | null;
	onCopy: (text: string, id: string) => void;
	onRevokeKey: (keyId: string) => void;
	onCreateKey: () => void;
	setShowCreateForm: (show: boolean) => void;
	setNewKeyName: (name: string) => void;
}

function ApiKeyManagerComponent({
	keys,
	loading,
	creating,
	showCreateForm,
	newKeyName,
	copied,
	revokingId,
	onCopy,
	onRevokeKey,
	onCreateKey,
	setShowCreateForm,
	setNewKeyName,
}: ApiKeyManagerProps) {
	const [confirmKeyId, setConfirmKeyId] = useState<string | null>(null);

	const handleRevokeClick = (keyId: string) => {
		setConfirmKeyId(keyId);
	};

	const handleConfirmRevoke = () => {
		if (confirmKeyId) {
			onRevokeKey(confirmKeyId);
			setConfirmKeyId(null);
		}
	};

	const handleCancelRevoke = () => {
		setConfirmKeyId(null);
	};

	const keyToRevoke = keys.find((k) => k.id === confirmKeyId);

	return (
		<>
			<div className="flex flex-col p-6">
				<div className="mb-6 flex items-center justify-between border-b border-border pb-4">
					<div>
						<h2 className="text-sm font-semibold text-text-bright">API keys</h2>
						<p className="mt-0.5 text-[11px] text-text-muted">
							{keys.length} key{keys.length === 1 ? "" : "s"} on this account
						</p>
					</div>
					<button
						type="button"
						onClick={() => setShowCreateForm(true)}
						className="group flex items-center justify-center border border-accent/30 bg-accent/10 px-4 py-2 min-h-[36px] text-xs font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						+ New key
					</button>
				</div>

				{showCreateForm && (
					<div className="mb-6 border border-success/20 bg-success/5 p-4">
						<div className="flex flex-col sm:flex-row gap-3">
<input
							type="text"
							value={newKeyName}
							onChange={(e) => setNewKeyName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && onCreateKey()}
							placeholder="Production, Staging, Dev..."
							aria-label="API key name"
							className="flex-1 border border-border bg-void px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
							disabled={creating}
						/>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={onCreateKey}
									disabled={creating || !newKeyName.trim()}
									className="flex items-center justify-center border border-accent bg-accent px-5 py-2 text-xs font-medium text-void transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
								>
									{creating ? "Creating…" : "Create key"}
								</button>
								<button
									type="button"
									onClick={() => {
										setShowCreateForm(false);
										setNewKeyName("");
									}}
									className="flex items-center justify-center border border-border bg-transparent px-4 py-2 text-xs text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
									disabled={creating}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				{loading && keys.length === 0 ? (
					<div className="border border-border p-4 text-xs text-text-muted">
						<span className="inline-block h-2 w-2 bg-text-muted animate-pulse mr-2" />
						Loading keys…
					</div>
				) : keys.length === 0 ? (
					<div className="border border-dashed border-border p-8 text-center">
						<div className="mb-2 text-sm font-medium text-text-bright">
							No API keys yet
						</div>
						<p className="mb-4 text-xs text-text-muted">
							Create your first key to start making API calls.
						</p>
						<button
							type="button"
							onClick={() => setShowCreateForm(true)}
							className="inline-flex items-center justify-center border border-accent bg-accent px-5 py-2 min-h-[36px] text-xs font-medium text-void transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							Create your first key
						</button>
					</div>
				) : (
					<div className="border border-border">
						{keys.map((key) => (
							<div
								key={key.id}
								className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-void border-b border-border last:border-b-0 hover:bg-surface transition-colors"
							>
								<div className="mb-3 sm:mb-0 min-w-0 flex-1">
									<div className="text-sm font-medium text-text">
										{key.name}
									</div>
									<div className="mt-1 text-xs text-text-muted font-mono">
										{maskKey(key.prefix)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									<div className="text-[11px] text-text-muted hidden sm:block mr-2">
										{key.createdAt
											? new Date(key.createdAt).toISOString().split("T")[0]
											: "—"}
									</div>
									<button
										type="button"
										onClick={() => onCopy(key.prefix, `prefix-${key.id}`)}
										aria-label="Copy API key prefix"
										className="flex items-center justify-center px-3 py-2 min-h-[36px] text-xs font-medium text-text-muted hover:text-accent focus-ring focus-visible:text-accent"
									>
										{copied === `prefix-${key.id}` ? "Copied" : "Copy"}
									</button>
									<button
										type="button"
										onClick={() => handleRevokeClick(key.id)}
										disabled={revokingId === key.id || confirmKeyId !== null}
										aria-label="Revoke API key"
										className="flex items-center justify-center px-3 py-2 min-h-[36px] text-xs font-medium text-text-muted hover:text-error focus-ring focus-visible:text-error disabled:opacity-50"
									>
										{revokingId === key.id ? "Revoking…" : "Revoke"}
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{confirmKeyId && keyToRevoke && (
				<div
					role="alertdialog"
					aria-modal="true"
					aria-labelledby="revoke-dialog-title"
					aria-describedby="revoke-dialog-description"
					className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm"
				>
					<div className="mx-4 w-full max-w-md border border-border bg-panel p-6 shadow-2xl">
						<h3
							id="revoke-dialog-title"
							className="mb-2 text-sm font-semibold text-error"
						>
							Revoke this API key?
						</h3>
						<p
							id="revoke-dialog-description"
							className="mb-6 text-sm text-text-secondary"
						>
							You are about to revoke{" "}
							<span className="font-medium text-text">{keyToRevoke.name}</span>.
							This action cannot be undone — any applications using this key
							will immediately lose access.
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={handleCancelRevoke}
								className="flex items-center justify-center border border-border bg-transparent px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleConfirmRevoke}
								className="flex items-center justify-center border border-error bg-error/10 px-5 py-2 text-xs font-medium text-error transition-colors hover:bg-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								Revoke key
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export const ApiKeyManager = memo(ApiKeyManagerComponent, (prev, next) => {
	return (
		prev.keys === next.keys &&
		prev.loading === next.loading &&
		prev.creating === next.creating &&
		prev.showCreateForm === next.showCreateForm &&
		prev.newKeyName === next.newKeyName &&
		prev.copied === next.copied &&
		prev.revokingId === next.revokingId
	);
});
