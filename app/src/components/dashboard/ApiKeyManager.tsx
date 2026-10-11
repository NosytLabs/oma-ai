"use client";

import { memo, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { ApiKey, ApiKeyCreateOptions } from "@/lib/api";
import { ApiKeyCreateForm } from "./ApiKeyCreateForm";
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
	onCreateKey: (options?: ApiKeyCreateOptions) => void;
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
	const revokeTrapRef = useRef<HTMLDivElement>(null);
	const revokeTriggerRef = useRef<HTMLButtonElement | null>(null);

	const handleRevokeClick = (keyId: string, trigger: HTMLButtonElement) => {
	revokeTriggerRef.current = trigger;
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
	useFocusTrap({
	active: !!confirmKeyId && !!keyToRevoke,
	containerRef: revokeTrapRef,
	restoreFocusRef: revokeTriggerRef,
	onClose: () => setConfirmKeyId(null),
	});

		return (
		<div className="bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative overflow-hidden h-full transition-[border-color,background-color] hover:border-accent/40 duration-200 ease-out">
		<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/40 via-accent/20 to-transparent" />
	<div className="flex flex-col p-6 sm:p-8">
	<div className="mb-6 flex flex-wrap gap-4 items-center justify-between border-b border-border/50 pb-4">
	<div>
	<h2 className="text-base font-bold text-text-bright tracking-tight">
	API keys
	</h2>
	<p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">
	{keys.length} key{keys.length === 1 ? "" : "s"} on this account
	</p>
	</div>
	{!showCreateForm && <button
	type="button"
	onClick={() => setShowCreateForm(true)}
	className="group flex items-center justify-center rounded-[var(--radius-sm)] border border-accent/40 bg-accent/10 px-4 py-2 min-h-[36px] text-xs font-semibold text-accent transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-out hover:bg-accent/20 hover:border-accent/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
	>
	+ New key
	</button>}
	</div>

		{showCreateForm && (
			<ApiKeyCreateForm
				name={newKeyName}
				setName={setNewKeyName}
				creating={creating}
				onCreate={onCreateKey}
				onCancel={() => { setShowCreateForm(false); setNewKeyName(""); }}
			/>
		)}
	{loading && keys.length === 0 ? (
	<div className="rounded-[var(--radius-md)] border border-border bg-surface/30 p-6 text-sm font-medium text-text-muted flex items-center justify-center">
	<span className="inline-block h-3 w-3 rounded-full bg-accent/60 animate-ping mr-3" />
	Loading keys…
	</div>
	) : keys.length === 0 && !showCreateForm ? (
	<div className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface/20 p-10 text-center transition-colors duration-200 ease-out hover:bg-surface/30 hover:border-accent/30">
	<div className="mb-2 text-sm font-semibold text-text-bright">
	No API keys yet
	</div>
	<p className="mb-6 text-sm text-text-muted max-w-sm mx-auto">
	Create your first key to start making API calls securely.
	</p>
	<button
	type="button"
	onClick={() => setShowCreateForm(true)}
	className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-accent bg-accent px-6 py-3 min-h-[40px] text-xs font-bold uppercase tracking-wider text-text-inverse shadow-[0_0_20px_-5px_var(--color-accent-glow)] transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-out hover:bg-accent/90 hover:shadow-[0_0_25px_-2px_var(--color-accent-glow)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
	>
	Create your first key
	</button>
	</div>
		) : keys.length > 0 ? (
		<div className="rounded-[var(--radius-md)] border border-border bg-void overflow-hidden shadow-sm">
		{keys.map((key) => (
		<div
		key={key.id}
		className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-void border-b border-border last:border-b-0 hover:bg-surface/50 transition-colors duration-200"
		>
		<div className="mb-3 sm:mb-0 min-w-0 flex-1">
		<div className="text-sm font-semibold text-text-bright transition-colors duration-200 ease-out group-hover:text-accent">
		{key.name}
		</div>
		<div className="mt-1 text-xs text-text-muted font-mono bg-surface/50 inline-block px-2 py-0.5 rounded-[var(--radius-sm)] border border-border/50 tabular-nums">
		{maskKey(key.prefix)}
		</div>
		<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
			<span>{key.expiresAt ? `${new Date(key.expiresAt).getTime() <= Date.now() ? "Expired" : "Expires"} ${new Date(key.expiresAt).toLocaleDateString()}` : "No expiry"}</span>
			<span>Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}</span>
		</div>
		<p className="mt-1 break-all text-xs text-text-muted">{key.allowedModels?.length ? `Models: ${key.allowedModels.join(", ")}` : "All models"}</p>
		<p className="mt-1 break-all text-xs text-text-muted">{key.ipAllowlist?.length ? `Allowed IPs: ${key.ipAllowlist.join(", ")}` : "Any IP address"}</p>
		</div>
		<div className="flex items-center gap-2">
		<div className="text-[11px] font-mono text-text-muted hidden sm:block mr-4 opacity-70 group-hover:opacity-100 transition-opacity duration-200 ease-out tabular-nums">
		{key.createdAt
		? new Date(key.createdAt).toISOString().split("T")[0]
		: "—"}
		</div>
		<button
		type="button"
		onClick={() => onCopy(key.prefix, `prefix-${key.id}`)}
		aria-label="Copy API key prefix"
		className="flex items-center justify-center rounded-[var(--radius-sm)] px-3 py-1.5 min-h-[32px] text-xs font-semibold text-text-secondary transition-[background-color,border-color,color,transform] duration-200 ease-out hover:bg-surface-elevated hover:text-text-bright hover:border hover:border-border border border-transparent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		>
		{copied === `prefix-${key.id}` ? "Copied!" : "Copy prefix"}
		</button>
		<button
		type="button"
		ref={(el) => {
		if (key.id === confirmKeyId)
		revokeTriggerRef.current = el;
		}}
		onClick={(e) => handleRevokeClick(key.id, e.currentTarget)}
		disabled={revokingId === key.id || confirmKeyId !== null}
		aria-label="Revoke API key"
		className="flex items-center justify-center rounded-[var(--radius-sm)] px-3 py-1.5 min-h-[32px] text-xs font-semibold text-text-secondary transition-[background-color,border-color,color,transform] duration-200 ease-out hover:bg-danger/10 hover:text-danger hover:border hover:border-danger/30 border border-transparent active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
		>
		{revokingId === key.id ? "Revoking…" : "Revoke"}
		</button>
		</div>
		</div>
		))}
		</div>
		) : null}
	</div>

		{confirmKeyId && keyToRevoke && (
		<div
		ref={revokeTrapRef}
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="revoke-dialog-title"
		aria-describedby="revoke-dialog-description"
		className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-md"
		>
		<div className="mx-4 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-panel p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] scale-100 animate-in fade-in zoom-in-95 duration-200">
		<h3
		id="revoke-dialog-title"
		className="mb-2 text-lg font-bold text-error flex items-center gap-2"
		>
		<span className="inline-block w-2 h-2 rounded-full bg-error animate-pulse" aria-hidden="true" aria-label="Warning dot" />
		Revoke this API key?
		</h3>
		<p
		id="revoke-dialog-description"
		className="mb-6 text-sm text-text-secondary leading-relaxed"
		>
		You are about to revoke the key{" "}
		<strong className="font-semibold text-text-bright px-1 py-0.5 bg-surface rounded-[var(--radius-sm)] border border-border">
		{keyToRevoke.name}
		</strong>
		. This action cannot be undone — any applications using this key
		will immediately lose access and start failing.
		</p>
	<div className="flex justify-end gap-3 pt-4 border-t border-border/50">
	<button
	type="button"
	onClick={handleCancelRevoke}
	className="flex items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-out hover:bg-surface-elevated hover:text-text-bright active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
	>
	Cancel
	</button>
	<button
	type="button"
	onClick={handleConfirmRevoke}
	className="flex items-center justify-center rounded-[var(--radius-sm)] border border-error bg-error px-5 py-2 text-sm font-bold text-text-inverse transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-out hover:bg-error/90 active:scale-[0.97] shadow-[0_0_15px_-3px_var(--color-error-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
	>
	Yes, revoke key
	</button>
	</div>
	</div>
	</div>
	)}
	</div>
	);
}

export const ApiKeyManager = memo(ApiKeyManagerComponent);
