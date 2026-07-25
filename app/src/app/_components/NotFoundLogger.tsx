"use client";

import { useEffect } from "react";
import { log } from "@/lib/logger";

/**
 * Client island for not-found logging — keeps the rest of `not-found.tsx`
 * a server component so Next 15 can prerender it cleanly.
 */
export function NotFoundLogger({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		if (process.env.NODE_ENV === "production") {
			log.warn("[404] Page not found", { path: window.location.pathname });
		}
	}, []);
	return <>{children}</>;
}
