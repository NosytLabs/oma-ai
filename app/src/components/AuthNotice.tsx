"use client";

import { ShieldAlert, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AuthNotice() {
	const params = useSearchParams();
	const router = useRouter();
	const auth = params.get("auth");
	const next = params.get("next");

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
			? `Your session expired. Sign in with your wallet or account number to continue to ${targetLabel}.`
			: `Sign in with your wallet or anonymous account number to continue to ${targetLabel}.`;

	const dismiss = () => {
		const url = new URL(window.location.href);
		url.searchParams.delete("auth");
		url.searchParams.delete("next");
		router.replace(`${url.pathname}${url.search ? url.search : ""}`, {
			scroll: false,
		});
	};

	return (
		<div
			role="status"
			aria-live="polite"
			className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 max-w-[92vw] px-4 py-3 border border-warning bg-void text-text-bright text-[12.5px] font-mono tracking-wide"
			style={{ boxShadow: "0 0 24px rgba(255, 184, 0, 0.25)" }}
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
				className="ml-1 text-text-muted hover:text-text-bright transition-colors"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}
