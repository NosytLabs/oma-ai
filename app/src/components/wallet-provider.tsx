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
	useConnection,
	useConnect,
	useDisconnect,
	useSignMessage,
	WagmiProvider,
} from "wagmi";
import { base } from "wagmi/chains";
import { api, setAuthToken, type User } from "@/lib/api/index";
import { deleteSessionCookie, setSessionCookie } from "@/lib/cookies";
import { getWagmiConfigSingleton } from "@/lib/wagmi";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import {
	type AuthMethod,
	WalletContext,
	type WalletKind,
} from "./wallet-context";

export type { AuthMethod } from "./wallet-context";

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

const DEMO_COOKIE_NAME = "oma-demo";
const DEMO_PUBLIC_COOKIE_NAME = "oma-demo-public";

function clearDemoCookie() {
	if (typeof document === "undefined") return;
	deleteCookie(DEMO_COOKIE_NAME);
	deleteCookie(DEMO_PUBLIC_COOKIE_NAME);
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
	// Prefer the real browser origin so SIWE domain matches the page the user
	// is on (localhost:3000 in dev, oma-ai.com in prod). Fallback is the app
	// origin — never the API port (3001), which would fail domain checks.
	const fallback =
		process.env.NEXT_PUBLIC_APP_URL ||
		(typeof window !== "undefined" ? window.location.origin : "https://oma-ai.com");
	const appUrl =
		typeof window !== "undefined" ? window.location.origin : fallback;
	let url: URL;
	try {
		url = new URL(appUrl);
	} catch {
		url = new URL("https://oma-ai.com");
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

function InnerProvider({
	children,
	mounted = false,
}: {
	children: ReactNode;
	mounted?: boolean;
}) {
	const {
		address,
		isConnected: evmConnected,
		chainId,
		isConnecting: evmConnecting,
	} = useConnection();
	const { connect, connectors } = useConnect();
	const { disconnect: evmDisconnect } = useDisconnect();
	const { signMessageAsync } = useSignMessage();

	// Always start null so SSR HTML matches the first client paint. Reading
	// document.cookie in useState() caused widespread hydration mismatches
	// (Next "1 Issue" badge) when oma_session_meta was present. Meta is still
	// applied synchronously in the mount effect below before paint settles.
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
			setUser(userData ?? null);
		} catch {
			setUser(null);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		const hasDemoCookie =
			typeof document !== "undefined" &&
			document.cookie
				.split("; ")
				.some((c) => c.startsWith(`${DEMO_PUBLIC_COOKIE_NAME}=`));
		if (hasDemoCookie) setIsDemo(true);

		// Hard-reload restore: the JWT lives only in the HttpOnly cookie, so the
		// JS-readable meta cookie is a hint, not authority. Always try /api/user
		// (proxy attaches cookie → Bearer). That way account-number login survives
		// a full page refresh even if meta was lost.
		const stored = getStoredSession();
		if (stored) {
			setSession(stored);
		}

		api.auth
			.getUser()
			.then((userData) => {
				if (cancelled) return;
				// 204 / null = anonymous (no valid HttpOnly session). Clear meta hint.
				if (!userData) {
					if (stored) {
						// Only drop the JS meta cookie — do not wipe UI if we merely
						// got an empty body during a race; treat as logged-out.
						setSession(null);
						setUser(null);
						try {
							document.cookie =
								"oma_session_meta=; Max-Age=0; path=/; SameSite=Strict";
						} catch {
							/* ignore */
						}
					} else {
						setUser(null);
					}
					return;
				}
				setUser(userData);
				const method =
					(userData as { authMethod?: AuthMethod }).authMethod ||
					stored?.authMethod ||
					"account-number";
				setSession({ token: "", authMethod: method });
				// Refresh the meta hint so UI state is stable across navigations.
				setCookie(
					"oma_session_meta",
					JSON.stringify({ authMethod: method }),
					7,
				);
			})
			.catch((err) => {
				if (cancelled) return;
				// Transient network / 429 / 5xx must NOT log the user out.
				// Keep the meta-session so the dashboard stays mounted; data
				// hooks will retry. Only clear on explicit auth failures.
				const msg = err instanceof Error ? err.message : String(err);
				const isAuthFail =
					/\b401\b|\b403\b|unauthorized|unauthenticated|invalid.?session|jwt/i.test(
						msg,
					);
				if (isAuthFail) {
					setSession(null);
					setUser(null);
					try {
						document.cookie =
							"oma_session_meta=; Max-Age=0; path=/; SameSite=Strict";
					} catch {
						/* ignore */
					}
				}
				// else: keep stored session; isAuthenticated stays true
			})
			.finally(() => {
				if (!cancelled) setIsReady(true);
			});

		return () => {
			cancelled = true;
		};
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
					// ponytail: /auth/verify now returns the canonical user
					// payload, so we skip the follow-up /user round-trip.
					if (verifyRes.user) {
						// `verifyRes.user.address` is nullable in the response
						// contract (account-only users have null `address`).
						// The local `User` type assumes a SIWE sign-in context
						// where we always have a verified EVM address, so
						// fall back to the verified wallet address.
						setUser({
							...verifyRes.user,
							address: verifyRes.user.address ?? address,
							createdAt: verifyRes.user.createdAt ?? new Date().toISOString(),
						} as Parameters<typeof setUser>[0]);
					}
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

	const value = useMemo(
		() => ({
			isReady: isReady && mounted,
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
			refreshUser,
		}),
		[
			isReady,
			mounted,
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
			<InnerProvider mounted={isMounted}>{children}</InnerProvider>
		</WagmiProvider>
	);
}

export { useWallet } from "./wallet-context";
