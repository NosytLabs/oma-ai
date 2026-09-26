"use client";

import { ShieldAlert, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AuthNotice() {
	const params = useSearchParams();
	const router = useRouter();
	const auth = params?.get("auth");
	const next = params?.get("next");

	useEffect(() => {
		if (auth !== "required" && auth !== "expired") return;
		const timer = setTimeout(() => {
			const url = new URL(window.location.href);
			url.searchParams.delete("auth");
			url.searchParams.delete("next");
			router.replace(`${url.pathname}${url.search ? url.search : ""}`, {
				scroll: false,
			});
		}, 8000);
		return () => clearTimeout(timer);
	}, [auth, router]);

	if (auth !== "required" && auth !== "expired") return null;

	const targetLabel =
		next === "/dashboard"
			? "dashboard"
			: next === "/chat"
				? "chat"
				: next === "/deposit"
					? "deposit"
					: next === "/settings"
						? "settings"
						: next === "/admin"
							? "admin"
							: next?.replace(/^\//, "") || "that page";

	const message =
		auth === "expired"
			? `Your session expired. Sign in by email or wallet to continue to ${targetLabel}.`
			: `Sign in by email or wallet to continue to ${targetLabel}.`;

	const dismiss = () => {
		const url = new URL(window.location.href);
		url.searchParams.delete("auth");
		url.searchParams.delete("next");
		router.replace(`${url.pathname}${url.search ? url.search : ""}`, {
			scroll: false,
		});
	};

	return (
		// Anchored below the 57px sticky Navbar (which is z-50) instead of on
		// top of it: at every width the notice used to cover the brand mark
		// and nav links for its full 8s life. `max-w-[92vw]` keeps the box off
		// the viewport edges at 320px.
		<div
			role="status"
			aria-live="polite"
			className="fixed top-[4.5rem] left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 border border-warning bg-void px-4 py-3 text-[12.5px] font-mono tracking-wide text-text-bright"
			style={{ boxShadow: "0 0 24px var(--color-warning-dim)" }}
		>
			<ShieldAlert
				className="h-4 w-4 text-warning shrink-0"
				aria-hidden="true"
			/>
			<span className="truncate">{message}</span>
			<button
				type="button"
				onClick={dismiss}
				aria-label="Dismiss notice"
				className="ml-1 text-text-muted hover:text-text-bright transition-colors duration-200 ease-out active:scale-[0.97]"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}
