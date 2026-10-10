"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { legacySettingsHref } from "@/lib/account-navigation";

function SettingsRedirect() {
	const router = useRouter();
	const search = useSearchParams();
	useEffect(() => {
		router.replace(legacySettingsHref(search, window.location.hash));
	}, [router, search]);
	return <p className="container-page py-10 text-text-muted" role="status">Opening account settings…</p>;
}

/** Keep bookmarked settings links working after moving account controls into the dashboard. */
export default function SettingsPage() {
	return <Suspense fallback={<p role="status">Opening account settings…</p>}><SettingsRedirect /></Suspense>;
}
