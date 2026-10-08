"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { playgroundHrefForModel } from "@/lib/playground-href";

interface ShareToast {
	success: (message: string) => void;
	error: (message: string) => void;
}

export type ModelLinkStatus = "default" | "success" | "error";

interface UseModelLinkShareOptions {
	model: string;
	toast: ShareToast;
}

interface ModelLinkShare {
	status: ModelLinkStatus;
	copyModelLink: () => Promise<void>;
}

/** Copies a deep link that opens chat with the current model selected. */
export function useModelLinkShare({
	model,
	toast,
}: UseModelLinkShareOptions): ModelLinkShare {
	const [status, setStatus] = useState<ModelLinkStatus>("default");
	const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const operationRef = useRef(0);

	const clearResetTimer = useCallback(() => {
		if (resetTimerRef.current !== null) {
			clearTimeout(resetTimerRef.current);
			resetTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			operationRef.current += 1;
			clearResetTimer();
		};
	}, [clearResetTimer]);

	const copyModelLink = useCallback(async () => {
		const operation = operationRef.current + 1;
		operationRef.current = operation;
		clearResetTimer();
		setStatus("default");

		const origin = typeof window === "undefined" ? "" : window.location.origin;
		const copied = await copyToClipboard(
			`${origin}${playgroundHrefForModel(model)}`,
		);
		if (operation !== operationRef.current) return;

		if (copied) {
			setStatus("success");
			toast.success("Model link copied to clipboard");
		} else {
			setStatus("error");
			toast.error("Could not copy model link — check clipboard permissions");
		}

		resetTimerRef.current = setTimeout(() => {
			if (operation === operationRef.current) setStatus("default");
			resetTimerRef.current = null;
		}, 2_000);
	}, [clearResetTimer, model, toast]);

	return { status, copyModelLink };
}
