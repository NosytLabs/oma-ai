"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { Message } from "@/components/chat";
import { genConversationId } from "@/lib/gen-id";

interface ShareToast {
	success: (message: string) => void;
	error: (message: string) => void;
}

type ShareStatus = "default" | "success" | "error";

interface UseConversationShareOptions {
	isChat: boolean;
	messages: Message[];
	model: string;
	conversationId: string;
	conversationIdKey?: string;
	toast: ShareToast;
	setConversationId: Dispatch<SetStateAction<string>>;
	setShareStatus: Dispatch<SetStateAction<ShareStatus>>;
}

/**
	* Copy a shareable link for the current conversation: chat mode links to
	* /chat?model=…, playground mode links to a replay URL carrying the
	* conversation id + message count + model.
	*/
export function useConversationShare(
	opts: UseConversationShareOptions,
): () => Promise<void> {
	const {
		isChat,
		messages,
		model,
		conversationId,
		conversationIdKey,
		toast,
		setConversationId,
		setShareStatus,
	} = opts;

	return useCallback(async () => {
		if (messages.length === 0) return;
		const origin =
			typeof window !== "undefined" ? window.location.origin : "";

		if (isChat) {
			// Chat: copy a link that opens chat with the current model pre-selected
			const url = `${origin}/chat?model=${encodeURIComponent(model)}`;
			setShareStatus("default");
			try {
				await navigator.clipboard.writeText(url);
				setShareStatus("success");
				toast.success(
					`Model link copied — opens chat with ${model} pre-selected`,
				);
				setTimeout(() => setShareStatus("default"), 2000);
			} catch {
				setShareStatus("error");
				toast.error("Could not copy link — check clipboard permissions");
				setTimeout(() => setShareStatus("default"), 2000);
			}
		} else {
			// Playground: copy a replay link with conversation id + message count
			let cid = conversationId;
			if (!cid && conversationIdKey) {
				cid = genConversationId();
				setConversationId(cid);
				try {
					localStorage.setItem(conversationIdKey, cid);
				} catch {
					/* private mode / corrupt storage */
				}
			}
			const userMessageCount = messages.filter((m) => m.role === "user").length;
			const url = `${origin}/chat?cid=${encodeURIComponent(cid ?? "")}&msgs=${userMessageCount}&model=${encodeURIComponent(model)}`;
			setShareStatus("default");
			try {
				await navigator.clipboard.writeText(url);
				setShareStatus("success");
				toast.success("Replay link copied to clipboard");
				setTimeout(() => setShareStatus("default"), 2000);
			} catch {
				setShareStatus("error");
				toast.error("Could not copy share link — check clipboard permissions");
				setTimeout(() => setShareStatus("default"), 2000);
			}
		}
	}, [
		isChat,
		messages,
		model,
		conversationId,
		conversationIdKey,
		toast,
		setConversationId,
		setShareStatus,
	]);
}