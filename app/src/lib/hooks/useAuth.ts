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
import { useSession, signOut as betterSignOut } from "@/lib/auth-client";

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
}

export interface BetterAuthSession {
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

export interface UseAuthResult {
	data: BetterAuthSession | null;
	user: BetterAuthUser | null;
	isAuthenticated: boolean;
	isPending: boolean;
	isReady: boolean;
	error: Error | null;
	evmAddress: string | null;
	signOut: () => Promise<void>;
	refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
	const session = useSession();
	const data = (session.data ?? null) as unknown as BetterAuthSession | null;
	const user = data?.user ?? null;
	const evmAddress = (user?.evmAddress as string | null | undefined) ?? null;

	// Better Auth's useSession is client-side. SSR initially has no
	// session until the first client-side fetch resolves; mark `isReady`
	// after the first tick so consumers can gate their loading skeletons.
	const [isReady, setIsReady] = useState(false);
	useEffect(() => {
		if (!session.isPending) setIsReady(true);
	}, [session.isPending]);

	return {
		data,
		user,
		isAuthenticated: !!user,
		isPending: session.isPending,
		isReady,
		error: session.error as Error | null,
		evmAddress,
		async signOut() {
			await betterSignOut();
		},
		async refresh() {
			await session.refetch();
		},
	};
}