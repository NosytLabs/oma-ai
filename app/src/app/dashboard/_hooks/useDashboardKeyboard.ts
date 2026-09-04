"use client";

import { useEffect, useRef } from "react";
import type { TabId } from "../_constants";

interface UseDashboardKeyboardOptions {
	setActiveTab: (tab: TabId) => void;
	setPage: (updater: (prev: number) => number) => void;
	activeTab: TabId;
	page: number;
	/** Whether a next page exists for the recent-requests table. */
	hasMorePages: boolean;
	onRefresh: () => void | Promise<void>;
}

/**
	* Dashboard-wide keyboard shortcuts.
	*
	*   R         — refresh dashboard
	*   1 / 2 / 3 — switch to Overview / Usage / API keys
	*   ArrowLeft / ArrowRight (Usage tab only) — paginate recent-requests
	*
	* Ignored while focus is in an input/textarea/select/contenteditable, and
	* when any modifier key is held (leaves Cmd+R etc. to the browser).
	*
	* `onRefresh` is captured via ref so the effect doesn't rebind every time
	* the caller re-creates the callback — same trick the inline handler used.
	*/
export function useDashboardKeyboard({
	setActiveTab,
	setPage,
	activeTab,
	page,
	hasMorePages,
	onRefresh,
}: UseDashboardKeyboardOptions) {
	const refreshRef = useRef(onRefresh);
	useEffect(() => {
		refreshRef.current = onRefresh;
	}, [onRefresh]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target) {
				const tag = target.tagName;
				if (
					tag === "INPUT" ||
					tag === "TEXTAREA" ||
					tag === "SELECT" ||
					target.isContentEditable
				) {
					return;
				}
			}
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			if (e.key === "r" || e.key === "R") {
				e.preventDefault();
				void refreshRef.current();
				return;
			}
			if (e.key === "1") {
				e.preventDefault();
				setActiveTab("overview");
				return;
			}
			if (e.key === "2") {
				e.preventDefault();
				setActiveTab("usage");
				return;
			}
			if (e.key === "3") {
				e.preventDefault();
				setActiveTab("api-keys");
				return;
			}
			if (activeTab === "usage") {
				if (e.key === "ArrowLeft" && page > 1) {
					setPage((p) => p - 1);
				} else if (e.key === "ArrowRight" && hasMorePages) {
					setPage((p) => p + 1);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [activeTab, page, hasMorePages, setActiveTab, setPage]);
}