"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import {
	AlertTriangle,
	Check,
	Copy,
	Key,
	Loader2,
	Plus,
	Settings,
	Trash2,
	Wallet,
	Zap,
} from "lucide-react";
import { useCallback, useId, useState } from "react";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useWallet } from "@/components/wallet-provider";
import { type ApiKey, type ApiKeyWithSecret, api } from "@/lib/api";
import { DEMO_API_KEYS } from "@/lib/demo-fixtures";
import { formatTime, maskKey } from "@/lib/utils";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

interface RateLimit {
	rpm: number;
	tpm: number;
}

export default function ApiKeysPage() {
	const { isAuthenticated, isDemo, connectEvm, isReady } = useWallet();
	const toast = useToast();
	const queryClient = useQueryClient();

	const keysQuery = useQuery({
		queryKey: ["apiKeys"],
		queryFn: () => api.auth.listKeys(),
		// Account-number sessions are authenticated without isConnected.
		enabled: isAuthenticated && !isDemo,
		staleTime: 60_000,
	});

	const keys: ApiKey[] = isDemo ? DEMO_API_KEYS : (keysQuery.data ?? []);
	const loading = isDemo ? false : keysQuery.isLoading;
	const error = isDemo
		? null
		: keysQuery.error instanceof Error
			? keysQuery.error.message
			: keysQuery.error
				? "Failed to load API keys"
				: null;

	const [creating, setCreating] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);

	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
	const [copied, setCopied] = useState<string | null>(null);

	const [editingLimits, setEditingLimits] = useState<string | null>(null);
	const [rateLimits, setRateLimits] = useState<Record<string, RateLimit>>({});
	const _id = useId();

	const handleCopy = useCallback(
		(text: string, id: string) => {
			navigator.clipboard.writeText(text);
			toast.success("Copied to clipboard");
			setCopied(id);
			setTimeout(() => setCopied(null), 2000);
		},
		[toast],
	);

	const handleCreateKey = useCallback(async () => {
		if (!newKeyName.trim()) return;
		if (isDemo) {
			toast.error("Demo mode is read-only — sign in to create keys");
			return;
		}
		setCreating(true);
		try {
			const key = await api.auth.createKey(newKeyName.trim());
			setCreatedKey(key);
			setNewKeyName("");
			setShowCreateForm(false);
			queryClient.setQueryData<ApiKey[]>(["apiKeys"], (prev) => [
				...(prev ?? []),
				{
					id: key.id,
					name: key.name,
					prefix: key.prefix,
					createdAt: key.createdAt,
					lastUsedAt: key.lastUsedAt,
				},
			]);
			setRateLimits((prev) => ({
				...prev,
				[key.id]: { rpm: 60, tpm: 100000 },
			}));
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Failed to create key";
			toast.error(msg);
		} finally {
			setCreating(false);
		}
	}, [isDemo, newKeyName, queryClient, toast]);

	const requestRevoke = useCallback((keyId: string) => {
		setConfirmRevokeId(keyId);
	}, []);

	const cancelRevoke = useCallback(() => {
		setConfirmRevokeId(null);
	}, []);

	const handleRevokeKey = useCallback(
		async (keyId: string) => {
			if (isDemo) {
				toast.error("Demo mode is read-only — sign in to manage keys");
				return;
			}
			setRevokingId(keyId);
			setConfirmRevokeId(null);
			try {
				await api.auth.deleteKey(keyId);
				queryClient.setQueryData<ApiKey[]>(["apiKeys"], (prev) =>
					(prev ?? []).filter((k) => k.id !== keyId),
				);
				toast.success("API key revoked");
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : "Failed to revoke key";
				toast.error(msg);
			} finally {
				setRevokingId(null);
			}
		},
		[isDemo, queryClient, toast],
	);

	const handleSaveLimits = useCallback(
		async (keyId: string) => {
			if (!keyId || !rateLimits[keyId]) return;
			if (isDemo) {
				toast.error("Demo mode is read-only — sign in to edit limits");
				return;
			}
			// biome-ignore lint/style/noNonNullAssertion: checked above
			const limits = rateLimits[keyId]!;
			try {
				await api.auth.updateKeyRateLimits(keyId, {
					rpm: limits.rpm,
					tpm: limits.tpm,
				});
				toast.success("Rate limits updated");
			} catch {
				toast.error("Failed to update rate limits");
			}
			setEditingLimits(null);
		},
		[isDemo, rateLimits, toast],
	);

	if (!isReady && !isAuthenticated) {
		return (
			<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
				<AuthSkeleton />
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<m.div
				className="flex min-h-[calc(100vh-4rem)] items-center justify-center"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<div className="text-center max-w-md px-4">
					<m.div
						className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-warning/10"
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
					>
						<Wallet className="h-10 w-10 text-accent" />
					</m.div>
					<h2 className="mb-3 text-2xl font-bold">Sign in to manage keys</h2>
					<p className="mb-6 text-text-muted">
						Use your wallet or account number — no wallet required for
						account-number sessions.
					</p>
					<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
						<a href="/login?next=/dashboard/api-keys" className="btn-primary py-3 px-8">
							Sign in
						</a>
						<m.button
							type="button"
							onClick={() => connectEvm()}
							className="btn-secondary flex items-center gap-2 py-3 px-8"
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
						>
							<Zap className="h-4 w-4" />
							Connect wallet
						</m.button>
					</div>
				</div>
			</m.div>
		);
	}

	return (
		<m.div
			className="mx-auto max-w-5xl px-4 py-8"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
		>
			<m.div
				className="mb-8 flex items-center justify-between"
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<div>
					<Breadcrumb
						items={[
							{ label: "Dashboard", href: "/dashboard" },
							{ label: "API Keys" },
						]}
					/>
					<h1 className="h1-utility text-text-bright">API Keys</h1>
					<p className="mt-1 text-sm text-text-muted">
						Manage your API keys and rate limits
					</p>
				</div>
				<m.button
					onClick={() => setShowCreateForm(true)}
					className="btn-primary flex items-center gap-2 py-2 px-4"
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
				>
					<Plus className="h-4 w-4" />
					Create Key
				</m.button>
			</m.div>

			<AnimatePresence>
				{error && (
					<m.div
						className="mb-6 flex items-center gap-3 rounded-xl border border-error/30 bg-error/10 px-4 py-3"
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 20 }}
					>
						<AlertTriangle className="h-4 w-4 shrink-0 text-error" />
						<span className="text-sm text-error">{error}</span>
					</m.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showCreateForm && (
					<m.div
						className="mb-6 rounded-xl border border-accent/30 bg-surface p-4"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
					>
						<div className="flex items-center gap-3">
							<label htmlFor={`${_id}-keyname`} className="sr-only">
								New API key name
							</label>
							<input
								id={`${_id}-keyname`}
								type="text"
								value={newKeyName}
								onChange={(e) => setNewKeyName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
								placeholder="Key name (e.g. production, staging)"
								autoComplete="off"
								spellCheck={false}
								aria-label="New API key name"
								className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-text-bright placeholder:text-text-muted"
								disabled={creating}
							/>
							<m.button
								onClick={handleCreateKey}
								disabled={creating || !newKeyName.trim()}
								className="btn-primary flex items-center gap-2 py-2 px-4 disabled:opacity-50"
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								{creating ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Key className="h-4 w-4" />
								)}
								Generate
							</m.button>
							<button
								type="button"
								onClick={() => {
									setShowCreateForm(false);
									setNewKeyName("");
								}}
								className="btn-secondary py-2 px-4"
								disabled={creating}
							>
								Cancel
							</button>
						</div>
					</m.div>
				)}
			</AnimatePresence>

			{loading && keys.length === 0 ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="card flex items-center gap-4 py-4"
						>
							<Skeleton className="h-10 w-10 rounded-lg" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-24" />
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-8 w-8 rounded-lg" />
								<Skeleton className="h-8 w-8 rounded-lg" />
							</div>
						</div>
					))}
				</div>
			) : keys.length === 0 ? (
				<m.div
					className="rounded-xl border border-border/50 bg-surface flex items-center justify-center py-16"
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
				>
					<div className="text-center">
						<Key className="h-12 w-12 mx-auto mb-4 text-text-muted" />
						<h3 className="text-lg font-semibold text-text-bright mb-2">
							No API Keys Yet
						</h3>
						<p className="text-sm text-text-muted mb-6">
							Create your first API key to start making requests.
						</p>
						<m.button
							onClick={() => setShowCreateForm(true)}
							className="btn-primary flex items-center gap-2 mx-auto py-3 px-6"
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
						>
							<Plus className="h-4 w-4" />
							Create API Key
						</m.button>
					</div>
				</m.div>
			) : (
				<div className="space-y-4">
					<AnimatePresence>
						{keys.map((key, index) => (
							<m.div
								key={key.id}
								className="rounded-xl border border-border/50 bg-surface p-6"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: index * 0.05 }}
							>
								<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
									<div className="flex items-center gap-4">
										<div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
											<Key className="h-6 w-6 text-accent" />
										</div>
										<div>
											<div className="flex items-center gap-2">
												<h3 className="text-lg font-semibold text-text-bright">
													{key.name}
												</h3>
												<span className="font-mono text-sm text-text-muted">
													{maskKey(key.prefix)}
												</span>
											</div>
											<div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
												<span>
													Created{" "}
													{key.createdAt
														? new Date(key.createdAt).toLocaleDateString()
														: "N/A"}
												</span>
												{key.lastUsedAt && (
													<>
														<span className="text-text-muted">|</span>
														<span>Last used {formatTime(key.lastUsedAt)}</span>
													</>
												)}
											</div>
										</div>
									</div>

									<div className="flex items-center gap-3">
										<m.button
											onClick={() => handleCopy(key.prefix, `prefix-${key.id}`)}
											className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated hover:text-accent"
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.95 }}
										>
											{copied === `prefix-${key.id}` ? (
												<>
													<Check className="h-4 w-4 text-success" />
													Copied
												</>
											) : (
												<>
													<Copy className="h-4 w-4" />
													Copy
												</>
											)}
										</m.button>

										<m.button
											onClick={() =>
												setEditingLimits(
													editingLimits === key.id ? null : key.id,
												)
											}
											className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
												editingLimits === key.id
													? "border-accent bg-accent/10 text-accent"
													: "border-border hover:bg-surface-elevated hover:text-accent"
											}`}
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.95 }}
										>
											<Settings className="h-4 w-4" />
											Limits
										</m.button>

										<m.button
											onClick={() => requestRevoke(key.id)}
											disabled={
												revokingId === key.id || confirmRevokeId !== null
											}
											className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-error transition-colors hover:bg-error/10 hover:border-error/50 disabled:opacity-50"
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.95 }}
										>
											{revokingId === key.id ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Trash2 className="h-4 w-4" />
											)}
											Revoke
										</m.button>
									</div>
								</div>

								<AnimatePresence>
									{editingLimits === key.id && (
										<m.div
											className="mt-4 pt-4 border-t border-border/50"
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
										>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div>
													<label
														htmlFor={`${_id}-${key.id}-rpm`}
														className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted"
													>
														Requests per Minute (RPM)
													</label>
													<input
														id={`${_id}-${key.id}-rpm`}
														type="number"
														value={rateLimits[key.id]?.rpm ?? 60}
														onChange={(e) =>
															setRateLimits((prev) => ({
																...prev,
																[key.id]: {
																	...prev[key.id],
																	rpm: parseInt(e.target.value, 10) || 0,
																},
															}))
														}
														className="w-full text-sm font-medium bg-void border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent/50"
														min={1}
														max={10000}
													/>
												</div>
												<div>
													<label
														htmlFor={`${_id}-${key.id}-tpm`}
														className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted"
													>
														Tokens per Minute (TPM)
													</label>
													<input
														id={`${_id}-${key.id}-tpm`}
														type="number"
														value={rateLimits[key.id]?.tpm ?? 100000}
														onChange={(e) =>
															setRateLimits((prev) => ({
																...prev,
																[key.id]: {
																	...prev[key.id],
																	tpm: parseInt(e.target.value, 10) || 0,
																},
															}))
														}
														className="w-full text-sm font-medium bg-void border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent/50"
														min={1}
														max={10000000}
													/>
												</div>
											</div>
											<div className="mt-4 flex justify-end gap-3">
												<button
													type="button"
													onClick={() => setEditingLimits(null)}
													className="btn-secondary py-2 px-4"
												>
													Cancel
												</button>
												<m.button
													onClick={() =>
														editingLimits && handleSaveLimits(editingLimits)
													}
													className="btn-primary py-2 px-4"
													whileHover={{ scale: 1.02 }}
													whileTap={{ scale: 0.98 }}
												>
													Save Limits
												</m.button>
											</div>
										</m.div>
									)}
								</AnimatePresence>
							</m.div>
						))}
					</AnimatePresence>
				</div>
			)}

			<AnimatePresence>
				{createdKey && (
					<m.div
						className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm p-4"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<m.div
							className="w-full max-w-lg rounded-2xl border border-accent/30 bg-surface p-6"
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							transition={{ type: "spring", damping: 25 }}
						>
							<div className="mb-4 flex items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
									<Key className="h-6 w-6 text-accent" />
								</div>
								<div>
									<h3 className="text-lg font-bold text-text-bright">
										API Key Created
									</h3>
									<p className="text-xs text-text-muted">
										Copy this key now - it will not be shown again
									</p>
								</div>
							</div>

							<div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
								<AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
								<span className="text-sm text-warning">
									This key will only be shown once. Copy it now.
								</span>
							</div>

							<div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-void p-4">
								<code className="flex-1 break-all text-sm text-accent font-mono">
									{createdKey.key}
								</code>
								<m.button
									onClick={() =>
										handleCopy(createdKey.key, `full-${createdKey.id}`)
									}
									className="shrink-0 rounded-lg p-2 transition-colors hover:bg-surface-elevated hover:text-accent"
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.95 }}
								>
									{copied === `full-${createdKey.id}` ? (
										<Check className="h-5 w-5 text-success" />
									) : (
										<Copy className="h-5 w-5" />
									)}
								</m.button>
							</div>

							<div className="mb-6 p-4 rounded-xl bg-surface-elevated border border-border">
								<h4 className="text-sm font-semibold text-text-bright mb-3">
									Quick Start
								</h4>
								<pre className="rounded-lg bg-void border border-border p-3 overflow-x-auto text-xs font-mono text-text-secondary whitespace-pre">
									<code>{`curl -X POST https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer ${createdKey.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama-3.2-3b","messages":[{"role":"user","content":"Hello"}]}'`}</code>
								</pre>
							</div>

							<m.button
								onClick={() => setCreatedKey(null)}
								className="btn-primary w-full py-3"
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								I have copied this key
							</m.button>
						</m.div>
					</m.div>
				)}
			</AnimatePresence>
			<AnimatePresence>
				{confirmRevokeId &&
					(() => {
						const keyToRevoke = keys.find((k) => k.id === confirmRevokeId);
						if (!keyToRevoke) return null;
						return (
							<m.div
								className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm p-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
							>
								<m.div
									role="alertdialog"
									aria-modal="true"
									aria-labelledby="apikeys-revoke-title"
									aria-describedby="apikeys-revoke-desc"
									className="w-full max-w-md rounded-2xl border border-error/30 bg-surface p-6 shadow-2xl"
									initial={{ scale: 0.9, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0.9, opacity: 0 }}
									transition={{ type: "spring", damping: 25 }}
								>
									<div className="mb-4 flex items-center gap-3">
										<div className="flex h-12 w-12 items-center justify-center rounded-xl border border-error/30 bg-error/10">
											<AlertTriangle className="h-6 w-6 text-error" />
										</div>
										<div>
											<h3
												id="apikeys-revoke-title"
												className="text-lg font-bold text-text-bright"
											>
												Revoke API Key
											</h3>
											<p className="text-xs text-text-muted">
												This action is irreversible
											</p>
										</div>
									</div>
									<p
										id="apikeys-revoke-desc"
										className="mb-6 text-sm text-text-secondary"
									>
										You are about to revoke{" "}
										<span className="font-mono text-text-bright">
											{keyToRevoke.name}
										</span>
										. Any applications using this key will immediately lose
										access.
									</p>
									<div className="flex justify-end gap-3">
										<button
											type="button"
											onClick={cancelRevoke}
											disabled={revokingId === confirmRevokeId}
											className="btn-secondary py-2 px-4 disabled:opacity-50"
										>
											Cancel
										</button>
										<m.button
											onClick={() => handleRevokeKey(confirmRevokeId)}
											disabled={revokingId === confirmRevokeId}
											className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error transition-colors hover:bg-error/20 disabled:opacity-50"
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.95 }}
										>
											{revokingId === confirmRevokeId ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Trash2 className="h-4 w-4" />
											)}
											Revoke
										</m.button>
									</div>
								</m.div>
							</m.div>
						);
					})()}
			</AnimatePresence>
		</m.div>
	);
}
