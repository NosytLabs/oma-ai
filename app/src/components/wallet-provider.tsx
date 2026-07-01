"use client";

import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { SiweMessage } from "siwe";
import {
	useAccount,
	useConnect,
	useDisconnect,
	useSignMessage,
	WagmiProvider,
} from "wagmi";
import { base } from "wagmi/chains";
import { api, setAuthToken, type User } from "@/lib/api/index";
import { deleteSessionCookie, setSessionCookie } from "@/lib/cookies";
import { getWagmiConfigSingleton } from "@/lib/wagmi";
import {
	type AuthMethod,
	WalletContext,
	type WalletKind,
} from "./wallet-context";

export type { AuthMethod } from "./wallet-context";

function useIsMounted() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	return mounted;
}

// L-A1: Secure is only valid on HTTPS — http://localhost dev runs on plain
// HTTP and the browser silently drops any Set-Cookie / document.cookie value
// that carries the Secure attribute. Without this conditional:
//   - oma_session_meta never gets written after SIWE verify in dev →
//     getStoredSession() returns null on every reload → isAuthenticated is
//     false even after a successful SIWE flow
//   - oma-demo (24h demo-mode entry cookie) is never set when the user
//     clicks "Try Demo" on /dashboard?demo=1
// mirrors the same conditional in lib/cookies.ts#getClientCookieString.
function isSecureEnv(): boolean {
	return process.env.NODE_ENV === "production";
}

function setCookie(name: string, value: string, maxAgeDays: number) {
	const expires = new Date(Date.now() + maxAgeDays * 86400000).toUTCString();
	const secure = isSecureEnv() ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict${secure}`;
}

function deleteCookie(name: string) {
	const secure = isSecureEnv() ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict${secure}`;
}

export const DEMO_COOKIE_NAME = "oma-demo";

export function setDemoCookie() {
	if (typeof document === "undefined") return;
	setCookie(DEMO_COOKIE_NAME, "1", 7);
}

export function clearDemoCookie() {
	if (typeof document === "undefined") return;
	deleteCookie(DEMO_COOKIE_NAME);
}

interface StoredSession {
	token: string;
	authMethod: AuthMethod;
}

function getStoredSession(): StoredSession | null {
	if (typeof window === "undefined") return null;
	try {
		// Read the non-HttpOnly meta cookie; never read the session token from
		// client-side storage. The HttpOnly session cookie is sent with every
		// same-origin request and verified by the server.
		const meta = getCookieValue("oma_session_meta");
		if (!meta) return null;
		const parsed = JSON.parse(meta) as { authMethod?: AuthMethod };
		return { token: "", authMethod: parsed.authMethod || "siwe" };
	} catch {
		return null;
	}
}

function getCookieValue(name: string): string | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie
		.split("; ")
		.find((c) => c.startsWith(`${name}=`));
	if (!match) return null;
	return decodeURIComponent(match.slice(name.length + 1));
}

function storeSession(token: string, authMethod: AuthMethod) {
	// C1 fix: the canonical session cookie is now HttpOnly, set server-side
	// by POST /api/auth/session/cookie. `setSessionCookie()` no longer writes
	// to `document.cookie` (JS can't carry HttpOnly via document.cookie
	// anyway — the browser silently drops the whole Set-Cookie value).
	// Instead it POSTs the JWT to the dedicated route, which emits
	// `Set-Cookie: __Host-oma_session=<jwt>; HttpOnly; Secure; SameSite=Strict`
	// in production. XSS can no longer trivially read the JWT out of
	// document.cookie. The JWT is still returned in the response body of
	// /v1/auth/verify so the React state below can keep an in-memory copy
	// (kept in `session.token`) for any client code that needs the raw
	// value (Authorization header on outbound API calls).
	//
	// B1 fix: the API client (`lib/api/client.ts`) now sources its bearer
	// token from a module-level in-memory cache (`getAuthToken()`) instead
	// of `document.cookie`. Mirror the freshly-received JWT into that cache
	// so the very next outbound request (e.g. `api.auth.getUser()` right
	// below) attaches `Authorization: Bearer <jwt>`. The HttpOnly cookie
	// set via `setSessionCookie` is what the proxy uses for the auth gate;
	// this cache is the fast-path for client-side `fetch` calls in the
	// window between login and the next page reload.
	//
	// Why both cookies (in addition to in-memory)?
	//   - HttpOnly oma_session  → authoritative copy, used by the Next.js
	//                             middleware to gate protected routes on
	//                             hard navigation / page reload. JS can't
	//                             read it; the browser auto-attaches it to
	//                             same-origin requests.
	//   - oma_session_meta (JS-readable) → carries the non-sensitive
	//                             authMethod hint so getStoredSession() can
	//     flip `isAuthenticated` to true on a hard reload BEFORE the
	//     /api/user round-trip completes. Without this, the dashboard
	//     would flash the "Connect Wallet" empty state.
	setSessionCookie(token, 7);
	setCookie("oma_session_meta", JSON.stringify({ authMethod }), 7);
	setAuthToken(token);
}

function clearSession() {
	// C1 fix: the JWT cookie is HttpOnly — JS CANNOT clear it. Only the
	// canonical /api/auth/logout server endpoint can expire the cookie
	// via a real Set-Cookie response. This helper clears the JS-readable
	// meta cookie and any legacy non-HttpOnly token (defensive), but the
	// authoritative JWT cookie is cleared by the logout flow above
	// (api.auth.logout → /api/auth/logout → server-side Set-Cookie with
	// Max-Age=0). L-A2 race window is closed: by the time clearSession()
	// runs, the server has already committed the cookie expiry, so no
	// in-flight request will see a stale Authorization header.
	//
	// B1 fix: also drop the in-memory bearer-token cache so the API
	// client doesn't keep attaching a stale Authorization header to
	// requests made after logout (e.g. polling, retry, optimistic UI).
	deleteSessionCookie();
	setAuthToken(null);
}

function buildSiweMessage(address: string, nonce: string): string {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
	let url: URL;
	try {
		url = new URL(appUrl);
	} catch {
		url = new URL("http://localhost:3000");
	}
	const siweMsg = new SiweMessage({
		domain: url.hostname,
		address,
		uri: url.origin,
		version: "1",
		chainId: base.id,
		nonce,
		statement: "I accept the OMA Terms of Service",
		issuedAt: new Date().toISOString(),
	});
	return siweMsg.toMessage();
}

function InnerProvider({ children }: { children: ReactNode }) {
	const {
		address,
		isConnected: evmConnected,
		chainId,
		isConnecting: evmConnecting,
	} = useAccount();
	const { connect, connectors } = useConnect();
	const { disconnect: evmDisconnect } = useDisconnect();
	const { signMessageAsync } = useSignMessage();

	const [session, setSession] = useState<StoredSession | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [isReady, setIsReady] = useState(false);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	// Demo mode is set by middleware when the user lands on /dashboard?demo=1.
	// It is a preview-only path: the user is treated as "connected + authenticated"
	// so the dashboard renders, but the page gates its queries on `!isDemo` so no
	// real backend calls are made.
	const [isDemo, setIsDemo] = useState(false);
	const siweDoneRef = useRef<`0x${string}` | undefined>(undefined);

	const availableConnectors = useMemo(() => {
		// B-1: surface MetaMask as its own connector when window.ethereum
		// reports isMetaMask. wagmi's `injected` connector bundles every
		// window.ethereum provider under a single "Injected" entry, which
		// hides MetaMask from the popular list and ships a generic wallet
		// icon. We do this client-side only so SSR is unchanged and the
		// existing wagmi config (injected + coinbaseWallet) is preserved.
		const eth =
			typeof window !== "undefined"
				? (window as { ethereum?: { isMetaMask?: boolean } }).ethereum
				: undefined;
		const isMetaMask = !!eth?.isMetaMask;
		return connectors.map((c) => {
			let name = c.name;
			if (c.id === "injected" && isMetaMask) {
				name = "MetaMask";
			}
			return { id: c.id, name, icon: c.icon };
		});
	}, [connectors]);

	const evmChain = useMemo(() => {
		if (!chainId) return undefined;
		const config = getWagmiConfigSingleton();
		const found = config.chains.find((c) => c.id === chainId);
		return found ? { id: found.id, name: found.name } : undefined;
	}, [chainId]);

	const refreshUser = useCallback(async () => {
		try {
			const userData = await api.auth.getUser();
			setUser(userData);
		} catch {
			setUser(null);
		}
	}, []);

	useEffect(() => {
		const hasDemoCookie =
			typeof document !== "undefined" &&
			document.cookie.split("; ").some((c) => c.startsWith("oma-demo="));
		if (hasDemoCookie) setIsDemo(true);

		const stored = getStoredSession();
		if (stored) {
			setSession(stored);
			api.auth
				.getUser()
				.then(setUser)
				.catch(() => {
					clearSession();
					setSession(null);
				});
		}
		setIsReady(true);
	}, []);

	useEffect(() => {
		if (
			!evmConnected ||
			!address ||
			siweDoneRef.current === address ||
			isAuthenticating
		)
			return;

		let cancelled = false;

		async function siweLogin() {
			setIsAuthenticating(true);
			try {
				// biome-ignore lint/style/noNonNullAssertion: value is guaranteed by preceding check
				const nonceRes = await api.auth.getNonce(address!);
				const nonce = nonceRes.nonce;

				// biome-ignore lint/style/noNonNullAssertion: value is guaranteed by preceding check
				const message = buildSiweMessage(address!, nonce);

				const signature = await signMessageAsync({ message });

				if (cancelled) return;

				const verifyRes = await api.auth.verify(message, signature, "siwe");

				if (cancelled) return;

				if (verifyRes.token) {
					storeSession(verifyRes.token, "siwe");
					setSession({ token: verifyRes.token, authMethod: "siwe" });
					siweDoneRef.current = address;
					const userData = await api.auth.getUser();
					setUser(userData);
				}
			} catch (err: unknown) {
				console.error("SIWE login failed:", err);
				const error = err as { code?: number; message?: string };
				if (
					error.code === 4001 ||
					error.message?.includes("User denied") ||
					error.message?.includes("rejected")
				) {
					evmDisconnect();
				}
			} finally {
				if (!cancelled) setIsAuthenticating(false);
			}
		}

		siweLogin();

		return () => {
			cancelled = true;
		};
	}, [
		evmConnected,
		address,
		signMessageAsync,
		isAuthenticating,
		evmDisconnect,
	]);

	const connectEvm = useCallback(
		async (connectorId?: string): Promise<void> => {
			const connector = connectorId
				? connectors.find((c) => c.id === connectorId)
				: connectors[0];
			if (!connector) return;
			// `connect()` returns a Promise that rejects when the user
			// rejects the wallet popup, the connector is not installed, or
			// the chain is wrong. Surface the rejection so the caller can
			// update UI state (toast, error banner, etc.) instead of silently
			// swallowing it.
			await connect({ connector });
		},
		[connect, connectors],
	);

	const disconnect = useCallback(async () => {
		if (isDemo) {
			clearDemoCookie();
			setIsDemo(false);
		}
		if (evmConnected) {
			evmDisconnect();
			siweDoneRef.current = undefined;
		}
		// D-C1 fix: invalidate the server-side JWT (and HttpOnly session
		// cookie) BEFORE clearing the client meta cookie. Without this the
		// server still has a valid session for up to 7 days and the user is
		// "logged out" client-side only. For demo users the request may 401
		// because there's no real session — that's expected and ignored.
		try {
			await api.auth.logout();
		} catch {
			// no-op: demo sessions have no JWT to invalidate
		}
		clearSession();
		setSession(null);
		setUser(null);
	}, [isDemo, evmConnected, evmDisconnect]);

	const signMessage = useCallback(
		async (message: string): Promise<string> => {
			if (!evmConnected) {
				throw new Error("No wallet connected. Please connect a wallet first.");
			}
			try {
				const sig = await signMessageAsync({ message });
				return sig;
			} catch (err) {
				console.error("SIWE sign failed:", err);
				throw new Error("Failed to sign message. Please try again.");
			}
		},
		[evmConnected, signMessageAsync],
	);

	const isConnected = evmConnected || !!session;
	const isConnecting = evmConnecting || isAuthenticating;
	const authMethod = session?.authMethod ?? null;
	const accountNumber = user?.accountNumber ?? null;
	const activeWallet: WalletKind = evmConnected
		? "evm"
		: authMethod === "account-number"
			? "account-number"
			: "none";

	const hasEvmWallet = !!evmConnected;
	const canDepositBase = !!evmConnected || !!accountNumber;
	const canUseSwap = !!evmConnected;

	const value = useMemo(
		() => ({
			isReady,
			isConnected: isDemo || isConnected,
			isAuthenticated: isDemo || !!session,
			isDemo,
			authMethod,
			accountNumber,
			connectEvm,
			disconnect,
			evmAddress: address,
			evmChain,
			signMessage,
			isConnecting,
			isAuthenticating,
			availableConnectors,
			activeWallet,
			hasEvmWallet,
			canDepositBase,
			canUseSwap,
			refreshUser,
		}),
		[
			isReady,
			isDemo,
			isConnected,
			session,
			authMethod,
			accountNumber,
			connectEvm,
			disconnect,
			address,
			evmChain,
			signMessage,
			isConnecting,
			isAuthenticating,
			availableConnectors,
			activeWallet,
			hasEvmWallet,
			canDepositBase,
			canUseSwap,
			refreshUser,
		],
	);

	return (
		<WalletContext.Provider value={value}>{children}</WalletContext.Provider>
	);
}

export function WalletProvider({
	children,
	mounted: mountedProp,
}: {
	children: ReactNode;
	mounted?: boolean;
}) {
	const isMountedFallback = useIsMounted();
	const isMounted = mountedProp ?? isMountedFallback;
	const config = getWagmiConfigSingleton();

	return (
		<WagmiProvider config={config}>
			{isMounted ? <InnerProvider>{children}</InnerProvider> : children}
		</WagmiProvider>
	);
}

export { useWallet } from "./wallet-context";
