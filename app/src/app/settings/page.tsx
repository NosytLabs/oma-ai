"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	Activity,
	AlertTriangle,
	type LucideIcon,
	Palette,
	Shield,
	Sparkles,
	User as UserIcon,
	X,
} from "lucide-react";
import nextDynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/hooks/useAuth";
import { api, type User } from "@/lib/api";

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
const PrivacySection = nextDynamic(() =>
	import("./_components/PrivacySection").then((m) => ({
		default: m.PrivacySection,
	})),
);

type SettingsTab = "profile" | "appearance" | "sessions" | "privacy" | "danger";

interface TabDef {
	id: SettingsTab;
	label: string;
	icon: LucideIcon;
	description: string;
	/** Small badge shown next to the label (e.g. "Caution"). */
	badge?: string;
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
		id: "sessions",
		label: "Sessions",
		icon: Activity,
		description: "Active devices",
	},
	{
		id: "privacy",
		label: "Privacy",
		icon: Shield,
		description: "Your data",
	},
	{
		id: "danger",
		label: "Danger zone",
		icon: AlertTriangle,
		description: "Irreversible actions",
		badge: "Caution",
	},
];

/** Compact labels for the mobile horizontal tab strip (avoid truncation). */
const MOBILE_TAB_LABEL: Record<SettingsTab, string> = {
	profile: "Profile",
	appearance: "Theme",
	sessions: "Sessions",
	privacy: "Privacy",
	danger: "Danger",
};

/**
 * Accept short aliases in ?tab= (e.g. theme → appearance).
 * NOTE: `api-keys` and `keys` are deliberately NOT handled here —
 * API keys live on the Dashboard. The deep-link useEffect below
 * redirects those URLs to /dashboard?tab=api-keys instead.
 */
function parseSettingsTab(raw: string | null | undefined): SettingsTab | null {
	if (!raw) return null;
	if (raw === "appearance" || raw === "theme") return "appearance";
	if (TABS.some((tab) => tab.id === raw)) return raw as SettingsTab;
	return null;
}

function SettingsPageContent() {
	const { isAuthenticated, isDemo, isReady, evmAddress, signOut } = useAuth();
	const hasRealSession = isAuthenticated && !isDemo;
	const router = useRouter();
	const searchParams = useSearchParams();

	const [user, setUser] = useState<User | null>(null);
	const [loadingUser, setLoadingUser] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const sessionsQuery = useQuery({
		queryKey: ["sessions"],
		queryFn: () => api.auth.listSessions(),
		enabled: hasRealSession,
		staleTime: 60_000,
	});
	const sessions = sessionsQuery.data?.sessions ?? [];
	const loading = loadingUser || sessionsQuery.isLoading;

	const [deleting, setDeleting] = useState(false);
	const [loggingOut, setLoggingOut] = useState(false);
	const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

	// Deep-link: /settings?tab=*
	// API keys used to live here — they now live on the Dashboard, so the
	// `api-keys` and `keys` aliases are intercepted and redirected to
	// /dashboard?tab=api-keys. Everything else falls through to
	// `parseSettingsTab` and updates the active tab.
	useEffect(() => {
		const raw = searchParams?.get("tab") ?? null;
		if (raw === "api-keys" || raw === "keys") {
			router.replace("/dashboard?tab=api-keys");
			return;
		}
		const parsed = parseSettingsTab(raw);
		if (parsed) setActiveTab(parsed);
	}, [searchParams, router]);

	useEffect(() => {
		if (!hasRealSession) return;
		let cancelled = false;
		const fetchData = async () => {
			setLoadingUser(true);
			setError(null);
			try {
				const userData = await api.auth.getUser();
				if (!cancelled) setUser(userData ?? null);
			} catch (e: unknown) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to load settings");
				}
			} finally {
				if (!cancelled) setLoadingUser(false);
			}
		};
		fetchData();
		return () => {
			cancelled = true;
		};
	}, [hasRealSession]);

	useEffect(() => {
		if (!sessionsQuery.error) return;
		setError(
			sessionsQuery.error instanceof Error
				? sessionsQuery.error.message
				: "Failed to load sessions",
		);
	}, [sessionsQuery.error]);

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

	const handleRevokeSession = async (id: string) => {
		try {
			await api.auth.revokeSession(id);
			await sessionsQuery.refetch();
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : "Failed to revoke session");
		}
	};

	const handleRevokeOtherSessions = async () => {
		try {
			await api.auth.revokeOtherSessions();
			await sessionsQuery.refetch();
		} catch (e: unknown) {
			setError(
				e instanceof Error ? e.message : "Failed to revoke other sessions",
			);
		}
	};

	if (!isReady) {
		// Match SettingsFallback so the layout does not flash an empty shell
		// while Better Auth resolves the session (or times out).
		return <SettingsFallback />;
	}

	if (!hasRealSession) {
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
						Settings covers your profile, theme, sessions, and data controls.
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
					className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-void px-3 py-1.5 text-xs font-medium text-text-muted transition-[border-color,color,opacity] duration-150 ease-out hover:border-error/40 hover:text-error active:scale-[0.97] disabled:opacity-40"
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

			<div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
				<div className="relative min-w-0 lg:block">
					{/* Mobile scroll-edge fades so users know to swipe. */}
					<div
						aria-hidden
						className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-bg to-transparent lg:hidden"
					/>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-bg to-transparent lg:hidden"
					/>
					<div
						role="tablist"
						aria-label="Settings sections"
						className="flex w-full min-w-0 flex-row gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:w-auto lg:flex-col lg:overflow-visible lg:pb-0"
					>
						{TABS.map((tab) => {
							const Icon = tab.icon;
							const isActive = activeTab === tab.id;
							const isDanger = tab.id === "danger";
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
									className={`group flex min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center text-[11px] transition-[border-color,background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] sm:min-w-0 sm:text-xs lg:w-full lg:flex-row lg:items-center lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-left lg:text-sm ${
										isDanger
											? isActive
												? "border-error/40 bg-error/10 text-error"
												: "border-transparent text-text-secondary hover:border-error/30 hover:bg-error/5 hover:text-error"
											: isActive
												? "border-accent/30 bg-accent/10 text-text-bright"
												: "border-transparent text-text-secondary hover:border-border hover:bg-surface/50 hover:text-text-bright"
									}`}
								>
									<Icon
										className={`h-4 w-4 shrink-0 ${
											isDanger
												? "text-error"
												: isActive
													? "text-accent"
													: "text-text-muted"
										}`}
										aria-hidden="true"
									/>
									<div className="min-w-0">
										<div className="truncate font-medium lg:hidden">
											{MOBILE_TAB_LABEL[tab.id]}
										</div>
										<div className="hidden items-center gap-1.5 lg:flex">
											<span className="font-medium">{tab.label}</span>
											{tab.badge && (
												<span
													className={`shrink-0 rounded-sm border px-1 py-px text-[9px] font-bold uppercase tracking-wider ${
														isDanger
															? "border-error/40 bg-error/10 text-error"
															: "border-border bg-surface text-text-muted"
													}`}
													aria-hidden="true"
												>
													{tab.badge}
												</span>
											)}
										</div>
										<div className="hidden truncate text-[11px] text-text-muted lg:block">
											{tab.description}
										</div>
									</div>
								</button>
							);
						})}
					</div>
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
								{activeTab === "sessions" && (
									<SessionsSection
										sessions={sessions}
										onSignOutCurrent={handleLogout}
										onRevokeSession={handleRevokeSession}
										onRevokeOthers={handleRevokeOtherSessions}
									/>
								)}
								{activeTab === "privacy" && <PrivacySection user={user} />}
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

function SettingsFallback() {
	return (
		<div className="mx-auto max-w-5xl px-4 py-10" aria-busy="true" aria-label="Loading settings">
			<div className="space-y-3">
				<Skeleton className="h-7 w-36" />
				<Skeleton className="h-4 w-48" />
				<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
					<div className="flex gap-2 lg:flex-col">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
					<div className="space-y-3">
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-24 w-full" />
					</div>
				</div>
			</div>
		</div>
	);
}

export default function SettingsPage() {
	return (
		<Suspense fallback={<SettingsFallback />}>
			<SettingsPageContent />
		</Suspense>
	);
}