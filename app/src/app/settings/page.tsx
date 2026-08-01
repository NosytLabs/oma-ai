"use client";

import Link from "next/link";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	Activity,
	AlertTriangle,
	Key,
	type LucideIcon,
	Palette,
	Shield,
	Sparkles,
	User as UserIcon,
	X,
} from "lucide-react";
import nextDynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { type ApiKey, api, type ApiKeyWithSecret, type Session, type User } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";

const ProfileSection = nextDynamic(() =>
	import("./_components/ProfileSection").then((m) => ({
		default: m.ProfileSection,
	})),
);
const AppearanceSection = nextDynamic(() =>
	import("./_components/AppearanceSection").then((m) => ({
		default: m.AppearanceSection,
	})),
);
const ApiKeysSection = nextDynamic(() =>
	import("./_components/ApiKeysSection").then((m) => ({
		default: m.ApiKeysSection,
	})),
);
const SessionsSection = nextDynamic(() =>
	import("./_components/SessionsSection").then((m) => ({
		default: m.SessionsSection,
	})),
);
const DangerZoneSection = nextDynamic(() =>
	import("./_components/DangerZoneSection").then((m) => ({
		default: m.DangerZoneSection,
	})),
);

type SettingsTab = "profile" | "appearance" | "api-keys" | "sessions" | "danger";

interface TabDef {
	id: SettingsTab;
	label: string;
	icon: LucideIcon;
	description: string;
}

const TABS: TabDef[] = [
	{
		id: "profile",
		label: "Profile",
		icon: UserIcon,
		description: "Account details",
	},
	{
		id: "appearance",
		label: "Appearance",
		icon: Palette,
		description: "Accent theme",
	},
	{
		id: "api-keys",
		label: "API keys",
		icon: Key,
		description: "Programmatic access",
	},
	{
		id: "sessions",
		label: "Sessions",
		icon: Activity,
		description: "Active devices",
	},
	{
		id: "danger",
		label: "Danger",
		icon: Shield,
		description: "Delete account",
	},
];

/** Compact labels for the mobile horizontal tab strip (avoid truncation). */
const MOBILE_TAB_LABEL: Record<SettingsTab, string> = {
	profile: "Profile",
	appearance: "Theme",
	"api-keys": "Keys",
	sessions: "Sessions",
	danger: "Danger",
};

/** Accept short aliases in ?tab= (e.g. keys → api-keys). */
function parseSettingsTab(raw: string | null | undefined): SettingsTab | null {
	if (!raw) return null;
	if (raw === "keys") return "api-keys";
	if (raw === "appearance" || raw === "theme") return "appearance";
	if (TABS.some((tab) => tab.id === raw)) return raw as SettingsTab;
	return null;
}

function currentSessionFallback(): Session {
	const ua =
		typeof navigator !== "undefined" ? navigator.userAgent : "This browser";
	let device = "This browser";
	if (/Edg\//i.test(ua)) device = "Microsoft Edge";
	else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) device = "Chrome";
	else if (/Firefox\//i.test(ua)) device = "Firefox";
	else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) device = "Safari";
	if (/Mobile|Android|iPhone/i.test(ua)) device = `${device} (mobile)`;

	return {
		id: "current",
		device,
		ip: "—",
		lastActive: new Date().toISOString(),
		current: true,
	};
}

export default function SettingsPage() {
	const { isAuthenticated, isReady, evmAddress, signOut } = useAuth();
	const toast = useToast();
	const searchParams = useSearchParams();

	const [user, setUser] = useState<User | null>(null);
	const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
	const [sessions, setSessions] = useState<Session[]>([currentSessionFallback()]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [deleting, setDeleting] = useState(false);
	const [loggingOut, setLoggingOut] = useState(false);
	const [copied, setCopied] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

	// Deep-link: /settings?tab=keys (alias for api-keys)
	useEffect(() => {
		const parsed = parseSettingsTab(searchParams?.get("tab") ?? null);
		if (parsed) setActiveTab(parsed);
	}, [searchParams]);

	useEffect(() => {
		if (!isAuthenticated) return;
		let cancelled = false;
		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const [userData, keysData] = await Promise.all([
					api.auth.getUser(),
					api.auth.listKeys(),
				]);
				if (!cancelled) {
					setUser(userData ?? null);
					setApiKeys(keysData.keys);
					// Multi-session listing endpoint is not wired yet — always
					// show at least the current browser session so the tab is
					// useful.
					setSessions([currentSessionFallback()]);
				}
			} catch (e: unknown) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to load settings");
					setSessions([currentSessionFallback()]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		fetchData();
		return () => {
			cancelled = true;
		};
	}, [isAuthenticated]);

	const handleCopy = useCallback(
		(text: string, id: string) => {
			void copyToClipboard(text).then((ok) => {
				if (!ok) {
					toast.error("Couldn't copy to clipboard");
					return;
				}
				toast.success("Copied to clipboard");
				setCopied(id);
				setTimeout(() => setCopied(null), 2000);
			});
		},
		[toast],
	);

	const handleLogout = async () => {
		setLoggingOut(true);
		try {
			await signOut();
			window.location.href = "/";
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : "Logout failed");
			setLoggingOut(false);
		}
	};

	const handleDeleteAccount = async () => {
		setDeleting(true);
		try {
			await api.auth.deleteAccount();
			window.location.href = "/";
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : "Account deletion failed");
			setDeleting(false);
		}
	};

	const handleRevokeKey = useCallback(async (keyId: string) => {
		await api.auth.deleteKey(keyId);
		setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
	}, []);

	const handleCreateKey = useCallback(async (key: ApiKeyWithSecret) => {
		setApiKeys((prev) => [...prev, key]);
	}, []);

	if (!isReady) {
		return (
			<div className="flex items-center justify-center px-4 py-10">
				<div className="h-12 w-12 animate-pulse rounded-full bg-surface-elevated/60" />
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className="flex items-center justify-center px-4 py-10">
				<m.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="w-full max-w-xl"
				>
					<m.div
						className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/5"
						whileHover={{ scale: 1.05 }}
						transition={{ type: "spring", stiffness: 400, damping: 10 }}
					>
						<UserIcon className="h-7 w-7 text-accent" />
					</m.div>
					<h1 className="mb-2 text-center text-xl font-bold tracking-tight text-text-bright">
						Sign in to manage your account
					</h1>
					<p className="mb-6 text-center text-sm text-text-secondary">
						Settings covers your profile, sessions, and API keys.
					</p>

					<ul className="mb-6 grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
						{TABS.slice(0, 4).map(({ icon: Icon, label, description }) => (
							<li
								key={label}
								className="flex items-start gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs"
							>
								<Icon
									className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted"
									aria-hidden="true"
								/>
								<div>
									<div className="font-medium text-text">{label}</div>
									<div className="text-text-muted">{description}</div>
								</div>
							</li>
						))}
					</ul>

					<div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
						<Link
							href="/login?next=/settings"
							className="inline-flex h-10 items-center justify-center rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-void transition-colors hover:bg-accent-bright"
						>
							Sign in →
						</Link>
						<Link
							href="/dashboard"
							className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
						>
							<Sparkles className="h-3 w-3" aria-hidden="true" />
							Back to dashboard
						</Link>
					</div>
					{evmAddress && (
						<p className="mt-4 text-center text-[10px] font-mono text-text-muted">
							Connected wallet: {evmAddress}
						</p>
					)}
				</m.div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
			<div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
				<m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
					<h1 className="text-2xl font-bold tracking-tight text-text-bright">
						Settings
					</h1>
					<p className="mt-1 text-sm text-text-muted">
						{loading
							? "Syncing…"
							: error
								? "Some sections may be stale"
								: "Up to date"}
					</p>
				</m.div>
				<button
					type="button"
					onClick={handleLogout}
					disabled={loggingOut}
					className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-void px-3 py-1.5 text-xs font-medium text-text-muted transition-all hover:border-error/40 hover:text-error disabled:opacity-40"
				>
					{loggingOut ? "Signing out…" : "Sign out"}
				</button>
			</div>

			<AnimatePresence>
				{error && (
					<m.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						className="mb-6 flex items-center gap-3 rounded-xl border border-error/30 bg-error/5 px-4 py-3"
					>
						<AlertTriangle className="h-4 w-4 shrink-0 text-error" />
						<span className="text-sm text-text">{error}</span>
						<button
							type="button"
							onClick={() => setError(null)}
							aria-label="Dismiss error"
							className="ml-auto rounded p-1 text-text-secondary hover:bg-error/10 hover:text-text"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</m.div>
				)}
			</AnimatePresence>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr] lg:gap-8 min-w-0">
				<div
					role="tablist"
					aria-label="Settings sections"
					className="flex w-full min-w-0 flex-row gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:w-auto lg:flex-col lg:overflow-visible lg:pb-0"
				>
					{TABS.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;
						return (
							<button
								type="button"
								key={tab.id}
								id={`tab-${tab.id}`}
								role="tab"
								aria-selected={isActive}
								aria-controls={`panel-${tab.id}`}
								onClick={() => {
									setActiveTab(tab.id);
									if (typeof window !== "undefined") {
										const url = new URL(window.location.href);
										url.searchParams.set("tab", tab.id);
										window.history.replaceState({}, "", url.toString());
									}
								}}
								className={`group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center text-[11px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-xs lg:w-full lg:flex-row lg:items-center lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-left lg:text-sm ${
									isActive
										? "border-accent/30 bg-accent/10 text-text-bright"
										: "border-transparent text-text-secondary hover:border-border hover:bg-surface/50 hover:text-text-bright"
								}`}
							>
								<Icon
									className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-text-muted"}`}
									aria-hidden="true"
								/>
								<div className="min-w-0">
									<div className="truncate font-medium lg:hidden">
										{MOBILE_TAB_LABEL[tab.id]}
									</div>
									<div className="hidden font-medium lg:block">{tab.label}</div>
									<div className="hidden truncate text-[11px] text-text-muted lg:block">
										{tab.description}
									</div>
								</div>
							</button>
						);
					})}
				</div>

				<div className="min-w-0">
					{loading && !user ? (
						<div className="space-y-3" aria-busy="true" aria-label="Loading settings">
							<Skeleton className="h-6 w-32" />
							<Skeleton className="h-4 w-64" />
							<div className="mt-4 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
								<Skeleton className="h-24 w-full rounded-none" />
								<Skeleton className="h-24 w-full rounded-none" />
								<Skeleton className="h-24 w-full rounded-none" />
							</div>
						</div>
					) : (
						<AnimatePresence mode="wait">
							<m.div
								key={activeTab}
								id={`panel-${activeTab}`}
								role="tabpanel"
								aria-labelledby={`tab-${activeTab}`}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.2 }}
							>
								{activeTab === "profile" && (
									<ProfileSection
										user={user}
										evmAddress={evmAddress}
										onUserChange={setUser}
										onError={setError}
									/>
								)}
								{activeTab === "appearance" && <AppearanceSection />}
								{activeTab === "api-keys" && (
									<ApiKeysSection
										apiKeys={apiKeys}
										onCopy={handleCopy}
										copied={copied}
										onRevokeKey={handleRevokeKey}
										onCreateKey={handleCreateKey}
									/>
								)}
								{activeTab === "sessions" && (
									<SessionsSection sessions={sessions} />
								)}
								{activeTab === "danger" && (
									<DangerZoneSection
										onDeleteAccount={handleDeleteAccount}
										deleting={deleting}
									/>
								)}
							</m.div>
						</AnimatePresence>
					)}
				</div>
			</div>
		</div>
	);
}