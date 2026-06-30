"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// `next/dynamic` with `ssr: false` cannot be used in a Server Component
// (Next.js restriction). layout.tsx is a Server Component, so we wrap the
// dynamic import in this Client Component. The result is the same as if
// we used `ssr: false` directly: the Toast module — which pulls in
// framer-motion's `useReducedMotion` and React's `useState` — is never
// executed during the server pre-render pass. That avoids the
// "Cannot read properties of null (reading 'useState')" crash that
// happens when the broken barrel loader in this Next 15.5.18 + React
// 19.2.6 stack hands framer-motion the hookless react-server build.
//
// useToast() in Toast.tsx is SSR-safe (returns a no-op when the
// context is null), so the pages that call it during server
// pre-render don't throw while the provider is still absent. The
// provider hydrates on the client and the real context takes over
// before any user interaction.
const ToastProvider = dynamic(
	() => import("./Toast").then((m) => m.ToastProvider),
	{ ssr: false },
);

export function ToastProviderClient({ children }: { children: ReactNode }) {
	return <ToastProvider>{children}</ToastProvider>;
}
