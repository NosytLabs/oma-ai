"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseChatScrollResult {
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	messagesEndRef: RefObject<HTMLDivElement | null>;
	isNearBottomRef: RefObject<boolean>;
	isScrolledAway: boolean;
	handleScroll: () => void;
	jumpToBottom: () => void;
}

/**
	* Scroll position tracking for the messages pane.
	*
	* - `scrollContainerRef` → the outer scrollable element
	* - `messagesEndRef`     → the sentinel at the bottom of the message list
	*                          that we scrollIntoView
	* - `isNearBottomRef`    → ref mirror of "user is at the bottom" (read by
	*                          the auto-scroll effect + by useStreamingChat's
	*                          `sendMessage`, which resets it to true to snap
	*                          the view to the latest message)
	* - `isScrolledAway`     → React state copy of the same flag, so the
	*                          "Jump to bottom" pill can re-render when the
	*                          user scrolls up
	* - `handleScroll`       → onScroll handler: updates the ref + state
	*                          based on a 120px threshold
	* - `jumpToBottom`       → smooth-scroll to the bottom and reset flags
	*/
export function useChatScroll(
	loading: boolean,
	_messages: unknown[],
	_deferredMessages: unknown[] = [],
): UseChatScrollResult {
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const isNearBottomRef = useRef(true);
	const [isScrolledAway, setIsScrolledAway] = useState(false);

	// Auto-scroll only when the user is already near the bottom — never
	// yank them back down if they've scrolled up to read history. During
	// streaming we use 'auto' (instant) so smooth-scroll animations don't
	// queue up and stutter on the 250ms batched updates. Keyed off the
	// last message's content length so the view follows growing content
	// on every batched update, not just loading transitions.
	const lastContentLen = (() => {
		const last = _deferredMessages[_deferredMessages.length - 1] as
			| { content?: string }
			| undefined;
		return last?.content?.length ?? 0;
	})();
	useEffect(() => {
		if (!isNearBottomRef.current) return;
		messagesEndRef.current?.scrollIntoView({
			behavior: loading ? "auto" : "smooth",
		});
	}, [loading, lastContentLen]);

	// On mount with restored history, snap to the latest message so
	// returning users aren't anchored at the top of a long thread. The
	// list renders via useDeferredValue, which lags one render behind —
	// keying off the deferred count (not the source array) guarantees we
	// scroll on the render where the DOM actually contains the messages.
	const mountedRef = useRef(false);
	const deferredCount = _deferredMessages.length;
	useEffect(() => {
		if (mountedRef.current || deferredCount === 0) return;
		mountedRef.current = true;
		const scroll = () => {
			const el = scrollContainerRef.current;
			if (el) {
				el.scrollTop = el.scrollHeight;
				isNearBottomRef.current = true;
			}
		};
		scroll();
		const raf = requestAnimationFrame(scroll);
		return () => cancelAnimationFrame(raf);
	}, [deferredCount]);

	const handleScroll = useCallback(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		const threshold = 120;
		const nearBottom =
			el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
		isNearBottomRef.current = nearBottom;
		setIsScrolledAway(!nearBottom);
	}, []);

	// 2.1 fix: jump-to-bottom button. Clicking resets the scroll to the
	// latest message so the user sees new tokens arriving during streaming.
	const jumpToBottom = useCallback(() => {
		isNearBottomRef.current = true;
		setIsScrolledAway(false);
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	return {
		scrollContainerRef,
		messagesEndRef,
		isNearBottomRef,
		isScrolledAway,
		handleScroll,
		jumpToBottom,
	};
}
