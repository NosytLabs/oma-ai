"use client";

import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	type LucideIcon,
	Palette,
	Shield,
	User as UserIcon,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { springs } from "@/lib/animation";
import { api } from "@/lib/api";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { useAuth } from "@/lib/hooks/useAuth";
import { UnauthCallout } from "@/components/shared/UnauthCallout";
import { AppearanceSection } from "./_components/AppearanceSection";
import { DangerZoneSection } from "./_components/DangerZoneSection";
import { PrivacySection } from "./_components/PrivacySection";
import { ProfileSection } from "./_components/ProfileSection";
import { SessionsSection } from "./_components/SessionsSection";

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
	const { isAuthenticated, isDemo, isReady, evmAddress, signOut, user } =
		useAuth();
	const hasRealSession = isAuthenticated && !isDemo;
	const router = useRouter();
	const searchParams = useSearchParams();
	const isDemoView = searchParams?.get("demo") === "1" || isDemo;

	const [error, setError] = useState<string | null>(null);
	const sessionsQuery = useQuery({
		queryKey: ["sessions"],
		queryFn: () => api.auth.listSessions(),
		enabled: hasRealSession,
		staleTime: 60_000,
	});
	const sessions = sessionsQuery.data?.sessions ?? [];
	const loading = !isReady || sessionsQuery.isLoading;

	const [deleting, setDeleting] = useState(false);
	const [loggingOut, setLoggingOut] = useState(false);
	const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

	// Demo tour user mock for settings preview
	const demoUser = isDemoView
		? {
				id: "demo-user-001",
				name: "Demo User",
				email: "demo@example.com",
				emailVerified: true,
				isAnonymous: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}
		: null;
	const displayUser = isDemoView ? demoUser : user;

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
		const hash =
			typeof window !== "undefined"
				? window.location.hash.replace(/^#/, "")
				: "";
		const parsed = parseSettingsTab(raw) ?? parseSettingsTab(hash);
		if (parsed) setActiveTab(parsed);
	}, [searchParams, router]);

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
			try {
				await signOut();
			} catch {
				/* session may already be gone */
			}
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

	if (!isReady && !isDemoView) {
		// Match SettingsFallback so the layout does not flash an empty shell
		// while Better Auth resolves the session (or times out).
		return <SettingsFallback />;
	}

	if (!hasRealSession && !isDemoView) {
		return <UnauthCallout variant="settings" evmAddress={evmAddress ?? undefined} />;
	}

	return (
		<div className="container-page max-w-5xl py-6 sm:py-8">
			{isDemoView && (
				<div
					role="status"
					className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 text-[11px] font-mono text-accent mb-6 rounded-[var(--radius-md)]"
				>
					<span className="uppercase tracking-wider">
						Demo tour · preview settings (read-only)
					</span>
					<Link
						href="/login?next=/settings"
						className="shrink-0 rounded-[var(--radius-sm)] bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void hover:bg-accent-bright"
					>
						Sign in for real settings
					</Link>
				</div>
			)}
			<div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
				<m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
					<h1 className="h1-utility text-text-bright">
						Settings
					</h1>
					<p className="mt-1 text-sm text-text-muted">
						{isDemoView
							? "Demo mode · preview only"
							: loading
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
					className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-void px-3 py-1.5 text-xs font-medium text-text-muted transition-[border-color,background-color,color,opacity,transform] duration-200 ease-out hover:border-error/40 hover:bg-error/10 hover:text-error active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-void"
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
						role="alert"
						aria-live="assertive"
						className="mb-6 flex items-center gap-3 rounded-[var(--radius-md)] border border-error/30 bg-error/10 px-4 py-3 shadow-[0_4px_24px_-10px_rgba(248,113,113,0.3)]"
					>
						<AlertTriangle className="h-4 w-4 shrink-0 text-error" />
						<span className="text-sm text-text-primary">{error}</span>
						<button
							type="button"
							onClick={() => setError(null)}
							aria-label="Dismiss error"
							className="ml-auto rounded-full p-1.5 text-text-secondary hover:bg-error/20 hover:text-error transition-[color,background-color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-void"
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
						className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-void to-transparent lg:hidden"
					/>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-void to-transparent lg:hidden"
					/>
					<div
						role="tablist"
						aria-label="Settings sections"
						onKeyDown={(e) => {
							const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
							if (!keys.includes(e.key)) return;
							e.preventDefault();
							const idx = TABS.findIndex((t) => t.id === activeTab);
							const nextIdx =
								e.key === "Home"
									? 0
									: e.key === "End"
										? TABS.length - 1
										: e.key === "ArrowDown" || e.key === "ArrowRight"
											? (idx + 1) % TABS.length
											: (idx - 1 + TABS.length) % TABS.length;
							const next = TABS[nextIdx];
							if (!next) return;
							setActiveTab(next.id);
							router.replace(`/settings?tab=${next.id}`, { scroll: false });
							document.getElementById(`tab-${next.id}`)?.focus();
						}}
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
									tabIndex={isActive ? 0 : -1}
									onClick={() => {
										setActiveTab(tab.id);
										router.replace(`/settings?tab=${tab.id}`, { scroll: false });
									}}
								className={`group flex min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] border px-2 py-2 text-center text-[11px] transition-[border-color,background-color,color,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] sm:min-w-0 sm:text-xs lg:w-full lg:flex-row lg:items-center lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-left lg:text-sm ${
									isDanger
										? isActive
											? "border-error/40 bg-error/10 text-error shadow-[0_0_15px_-5px_var(--color-error-glow)]"
											: "border-transparent text-text-secondary hover:border-error/30 hover:bg-error/10 hover:text-error"
										: isActive
											? "border-accent/30 bg-accent/10 text-text-bright shadow-[0_0_15px_-5px_var(--color-accent-glow)]"
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
					{loading && !user && !isDemoView ? (
						<div className="space-y-3" aria-busy="true">
							<div className="h-6 w-32 bg-surface animate-pulse" />
							<div className="h-4 w-64 bg-surface animate-pulse" />
							<div className="mt-4 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
								<div className="h-24 w-full rounded-none bg-surface animate-pulse" />
								<div className="h-24 w-full rounded-none bg-surface animate-pulse" />
								<div className="h-24 w-full rounded-none bg-surface animate-pulse" />
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
								transition={springs.tab}
							>
								{activeTab === "profile" && (
									<ProfileSection user={displayUser} evmAddress={isDemoView ? "0x1234...5678" : evmAddress} />
								)}
								{activeTab === "appearance" && <AppearanceSection />}
								{activeTab === "sessions" && (
									<SessionsSection
										sessions={isDemoView ? [{ id: "demo-session", userAgent: "Chrome on macOS", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), ipAddress: "127.0.0.1", isCurrent: true }] : sessions}
										onSignOutCurrent={handleLogout}
										onRevokeSession={handleRevokeSession}
										onRevokeOthers={handleRevokeOtherSessions}
									/>
								)}
								{activeTab === "privacy" && <PrivacySection user={displayUser} />}
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
		<div className="container-page max-w-5xl py-10" aria-busy="true">
			<div className="space-y-3">
				<div className="h-7 w-36 bg-surface animate-pulse" />
				<div className="h-4 w-48 bg-surface animate-pulse" />
				<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
					<div className="flex gap-2 lg:flex-col">
						<div className="h-12 w-full bg-surface animate-pulse rounded-[var(--radius-md)]" />
						<div className="h-12 w-full bg-surface animate-pulse rounded-[var(--radius-md)]" />
						<div className="h-12 w-full bg-surface animate-pulse rounded-[var(--radius-md)]" />
					</div>
					<div className="space-y-3">
						<div className="h-6 w-32 bg-surface animate-pulse" />
						<div className="h-24 w-full bg-surface animate-pulse" />
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
