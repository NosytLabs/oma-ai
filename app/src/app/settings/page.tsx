"use client";

import { AnimatePresence, m } from "framer-motion";
import {
	Activity,
	AlertTriangle,
	Hexagon,
	Key,
	KeyRound,
	type LucideIcon,
	Shield,
	Sparkles,
	User as UserIcon,
	Wallet,
	X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { useWallet } from "@/components/wallet-provider";
import { type ApiKey, api, type Session, type User } from "@/lib/api";

const AccountLoginModal = dynamic(
	() =>
		import("@/components/account-login-modal").then((m) => m.AccountLoginModal),
	{ ssr: false },
);

// Lazy-load each section so only the active tab pulls its code in.
const ProfileSection = dynamic(() =>
	import("./_components/ProfileSection").then((m) => ({
		default: m.ProfileSection,
	})),
);
const WalletsSection = dynamic(() =>
	import("./_components/WalletsSection").then((m) => ({
		default: m.WalletsSection,
	})),
);
const ApiKeysSection = dynamic(() =>
	import("./_components/ApiKeysSection").then((m) => ({
		default: m.ApiKeysSection,
	})),
);
const SessionsSection = dynamic(() =>
	import("./_components/SessionsSection").then((m) => ({
		default: m.SessionsSection,
	})),
);
const DangerZoneSection = dynamic(() =>
	import("./_components/DangerZoneSection").then((m) => ({
		default: m.DangerZoneSection,
	})),
);

type SettingsTab = "profile" | "wallets" | "api-keys" | "sessions" | "danger";

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
		id: "wallets",
		label: "Wallets",
		icon: Wallet,
		description: "Connected wallets & account number",
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

export default function SettingsPage() {
	const { isAuthenticated, connectEvm, disconnect } = useWallet();
	const toast = useToast();

	const [user, setUser] = useState<User | null>(null);
	const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [deleting, setDeleting] = useState(false);
	const [loggingOut, setLoggingOut] = useState(false);
	const [copied, setCopied] = useState<string | null>(null);
	const [unlinkingEvm, setUnlinkingEvm] = useState(false);
	const [generatingAccount, setGeneratingAccount] = useState(false);
	const [csrfToken, setCsrfToken] = useState<string | null>(null);
	const [showAccountLogin, setShowAccountLogin] = useState(false);
	const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

	useEffect(() => {
		let cancelled = false;
		api.auth
			.getCsrfToken()
			.then((res) => {
				if (!cancelled && res.token) setCsrfToken(res.token);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!isAuthenticated) return;
		let cancelled = false;
		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const [userData, keysData, sessionsData] = await Promise.all([
					api.auth.getUser(),
					api.auth.listKeys(),
					api.auth.listSessions(),
				]);
				if (!cancelled) {
					setUser(userData);
					setApiKeys(keysData);
					setSessions(sessionsData);
				}
			} catch (e: unknown) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to load settings");
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
			navigator.clipboard.writeText(text);
			toast.success("Copied to clipboard");
			setCopied(id);
			setTimeout(() => setCopied(null), 2000);
		},
		[toast],
	);

	const handleUnlinkEvm = async () => {
		setUnlinkingEvm(true);
		try {
			await api.auth.unlinkWallet("evm");
			disconnect();
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : "Failed to unlink EVM wallet");
		} finally {
			setUnlinkingEvm(false);
		}
	};

	const handleLogout = async () => {
		setLoggingOut(true);
		try {
			await api.auth.logout();
			disconnect();
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
			disconnect();
			window.location.href = "/";
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : "Account deletion failed");
			setDeleting(false);
		}
	};

	const handleGenerateAccountNumber = async () => {
		setGeneratingAccount(true);
		try {
			const result = await api.auth.createAccountNumber();
			setUser((prev) =>
				prev ? { ...prev, accountNumber: result.accountNumber } : null,
			);
			toast.success("Account number generated");
		} catch (e: unknown) {
			setError(
				e instanceof Error ? e.message : "Failed to generate account number",
			);
		} finally {
			setGeneratingAccount(false);
		}
	};

	const handleRevokeKey = async (keyId: string) => {
		await api.auth.deleteKey(keyId);
		setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
	};

	if (!isAuthenticated) {
		return (
			<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
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
						Settings covers your wallets, account number, sessions, and API
						keys.
					</p>

					<ul className="mb-6 grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
						{TABS.slice(0, 4).map(({ icon: Icon, label, description }) => (
							<li
								key={label}
								className="flex items-start gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs"
							>
								<Icon
									className="h-3.5 w-3.5 mt-0.5 text-text-muted shrink-0"
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
						<Button
							variant="primary"
							size="md"
							className="w-full sm:w-auto"
							onClick={() => connectEvm()}
							leftIcon={<Hexagon className="h-4 w-4" aria-hidden="true" />}
						>
							Connect wallet
						</Button>
						<Button
							variant="secondary"
							size="md"
							className="w-full sm:w-auto"
							onClick={() => setShowAccountLogin(true)}
							leftIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
						>
							Use account number
						</Button>
					</div>
					<div className="mt-4 flex flex-col items-center gap-2 text-center">
						<a
							href="/login?method=account&next=/settings"
							className="text-xs text-accent hover:underline underline-offset-2"
						>
							Open full login →
						</a>
						<a
							href="/dashboard?demo=1"
							className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
						>
							<Sparkles className="h-3 w-3" aria-hidden="true" />
							Try the dashboard in demo mode
						</a>
					</div>
				</m.div>

				{showAccountLogin && (
					<AccountLoginModal
						onClose={() => setShowAccountLogin(false)}
						initialCsrfToken={csrfToken}
					/>
				)}
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-5xl px-4 py-8">
			<m.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="mb-8"
			>
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
							className="ml-auto rounded p-1 text-text-secondary hover:bg-error/10 hover:text-text"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</m.div>
				)}
			</AnimatePresence>

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
				{/* Sidebar tabs */}
				<nav className="flex flex-col gap-1" aria-label="Settings sections">
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
								onClick={() => setActiveTab(tab.id)}
								className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
									<div className="font-medium">{tab.label}</div>
									<div className="text-[11px] text-text-muted truncate">
										{tab.description}
									</div>
								</div>
							</button>
						);
					})}
				</nav>

				{/* Tab panel */}
				<div className="min-w-0">
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
									onUserChange={setUser}
									onError={setError}
								/>
							)}
							{activeTab === "wallets" && (
								<WalletsSection
									user={user}
									onCopy={handleCopy}
									copied={copied}
									onGenerateAccountNumber={handleGenerateAccountNumber}
									generatingAccount={generatingAccount}
									onUnlinkEvm={handleUnlinkEvm}
									unlinkingEvm={unlinkingEvm}
								/>
							)}
							{activeTab === "api-keys" && (
								<ApiKeysSection
									apiKeys={apiKeys}
									onCopy={handleCopy}
									copied={copied}
									onLogout={handleLogout}
									loggingOut={loggingOut}
									onRevokeKey={handleRevokeKey}
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
				</div>
			</div>
		</div>
	);
}
