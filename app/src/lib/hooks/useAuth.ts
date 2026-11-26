"use client";

/**
	* Thin wrapper around Better Auth's `useSession()` that exposes a
	* wallet-style hook shape to the rest of the app.
	*
	*   const { user, isAuthenticated, isReady, evmAddress, signOut } = useAuth();
	*
	* The legacy `useWallet()` hook (wagmi + SIWE) was deleted in the
	* Better Auth rebuild — components that still consume a `wallet`-ish
	* shape import from here instead. Wallet-only fields like `connect()`
	* and `signMessage()` are gone; sign-in is handled by Better Auth
	* via the `/login` page (magic link, anonymous, SIWE plugin).
	*/
import { useEffect, useState } from "react";
import {
	useSession,
	type SignOutOptions,
	signOut as betterSignOut,
} from "@/lib/auth-client";

export interface BetterAuthUser {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	image?: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
	isAnonymous?: boolean | null;
	evmAddress?: string | null;
	role?: string | null;
}

interface BetterAuthSession {
	user: BetterAuthUser;
	session: {
		id: string;
		token: string;
		userId: string;
		expiresAt: Date | string;
		createdAt: Date | string;
		updatedAt: Date | string;
		ipAddress?: string | null;
		userAgent?: string | null;
	};
}

/**
 * The auth session lifecycle, explicit.
 *
 * The hook used to expose four independent booleans (`isPending`, `isReady`,
 * `isDemo`, `isAuthenticated`) whose combinations overlapped: nothing stopped
 * "isReady && isAuthenticated && isDemo" from being read as three facts when
 * it is one state. `authStatus` is the single state; the booleans below are
 * DERIVED views of it, so they can never disagree.
 */
export const AUTH_STATUS = {
	/** Session not resolved yet (pre-mount, or Better Auth still fetching). */
	Loading: "loading",
	/** Resolved: no session and no demo cookie. */
	Unauthenticated: "unauthenticated",
	/** Resolved: only the `oma-demo-public` preview cookie, no real session. */
	Demo: "demo",
	/** Resolved: a real Better Auth session. */
	Authenticated: "authenticated",
} as const;

export type AuthStatus = (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS];

interface UseAuthResult {
	data: BetterAuthSession | null;
	user: BetterAuthUser | null;
	/** The explicit session state. Prefer this over the derived booleans. */
	authStatus: AuthStatus;
	isAuthenticated: boolean;
	/** True when only the `oma-demo-public` demo cookie is present (no real
	 * Better Auth session). Consumers should treat this as "preview mode":
	 * pages may render, but API-backed actions (chat, deposits, credits)
	 * will reject with AUTH REQUIRED. UI must not claim an active session. */
	isDemo: boolean;
	isPending: boolean;
	isReady: boolean;
	error: Error | null;
	evmAddress: string | null;
	role: string | null;
	signOut: (options?: SignOutOptions) => Promise<void>;
	refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
	const session = useSession();
	const data = (session.data ?? null) as unknown as BetterAuthSession | null;
	const user = data?.user ?? null;
	const evmAddress = (user?.evmAddress as string | null | undefined) ?? null;
	const role = (user?.role as string | null | undefined) ?? null;

	// Demo bypass: the middleware sets `oma-demo-public` cookie when the
	// user hits a protected page with `?demo=1`. Mirror that here so the
	// client-side guardrails (dashboard layout, settings, etc.) see the
	// same view the middleware allowed.
	const [demoActive, setDemoActive] = useState(false);
	useEffect(() => {
		if (typeof document === "undefined") return;
		const read = () => {
			const c = document.cookie
				.split("; ")
				.find((row) => row.startsWith("oma-demo-public="));
			setDemoActive(c?.split("=")[1] === "1");
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") read();
		};
		read();
		window.addEventListener("focus", read);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			window.removeEventListener("focus", read);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);

	const [hasMounted, setHasMounted] = useState(false);
	useEffect(() => setHasMounted(true), []);

	// If Better Auth's get-session hangs (proxy 502 / dead backend), do not
	// leave gated pages on an infinite spinner. After SESSION_READY_TIMEOUT_MS
	// treat the session as resolved (unauthenticated) so sign-in gates render.
	const SESSION_READY_TIMEOUT_MS = 5_000;
	const [pendingTimedOut, setPendingTimedOut] = useState(false);
	useEffect(() => {
		if (!session.isPending) {
			setPendingTimedOut(false);
			return;
		}
		const id = window.setTimeout(() => {
			setPendingTimedOut(true);
		}, SESSION_READY_TIMEOUT_MS);
		return () => window.clearTimeout(id);
	}, [session.isPending]);

	const isReady = hasMounted && (!session.isPending || pendingTimedOut);

	// The explicit state machine: exactly one branch is ever true.
	const authStatus: AuthStatus = !isReady
		? AUTH_STATUS.Loading
		: user
			? AUTH_STATUS.Authenticated
			: demoActive
				? AUTH_STATUS.Demo
				: AUTH_STATUS.Unauthenticated;

	return {
		data,
		user,
		authStatus,
		// Legacy derived views, byte-identical to the pre-machine behavior so
		// no consumer sees a changed rendering window. New consumers should
		// read `authStatus` instead.
		isAuthenticated: !!user || demoActive,
		isDemo: demoActive && !user,
		isPending: session.isPending && !pendingTimedOut,
		isReady,
		error: session.error as Error | null,
		evmAddress,
		role,
		async signOut(options: SignOutOptions = {}) {
			await betterSignOut(options);
		},
		async refresh() {
			await session.refetch();
		},
	};
}
