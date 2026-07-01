"use client";

import { type ReactNode } from "react";
import { ToastProvider } from "./Toast";

export function ToastProviderClient({ children }: { children: ReactNode }) {
	return <ToastProvider>{children}</ToastProvider>;
}
