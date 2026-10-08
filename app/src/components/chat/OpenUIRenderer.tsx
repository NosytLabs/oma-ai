"use client";

import "@/lib/openui-disable-devtools";
import { Renderer, type ActionEvent } from "@openuidev/react-lang";
import { useCallback, useRef, useState } from "react";
import {
	normalizeOpenUIAction,
	type OpenUIActionHandler,
} from "@/lib/openui-actions";
import { omaOpenUILibrary } from "@/lib/openui";
import { OpenUIActionPendingContext } from "@/lib/openui-action-state";

export interface OpenUIRendererProps {
	response: string;
	isStreaming: boolean;
	onAction?: OpenUIActionHandler;
}

export function OpenUIRenderer(_props: OpenUIRendererProps) {
	const { response, isStreaming, onAction } = _props;
	const [actionState, setActionState] = useState<
		| { status: "idle" }
		| { status: "pending"; label: string }
		| { status: "success"; label: string }
		| { status: "error"; message: string }
	>({ status: "idle" });
	const actionPendingRef = useRef(false);

	const handleAction = useCallback(
		(event: ActionEvent) => {
			if (actionPendingRef.current) return;
			const action = normalizeOpenUIAction(event);
			if (!action) {
				setActionState({
					status: "error",
					message: "This generated action is not available.",
				});
				return;
			}
			if (!onAction) {
				setActionState({
					status: "error",
					message: "This action is not connected to the chat.",
				});
				return;
			}
			const label =
				action.type === "apply-settings"
					? "Applying settings"
					: "Sending follow-up";
			actionPendingRef.current = true;
			setActionState({ status: "pending", label });
			void (async () => {
				try {
					await onAction(action);
					setActionState({
						status: "success",
						label:
							action.type === "apply-settings"
								? "Settings applied"
								: "Follow-up sent",
					});
				} catch (error: unknown) {
					setActionState({
						status: "error",
						message:
							error instanceof Error
								? error.message
								: "The generated action could not be completed.",
					});
				} finally {
					actionPendingRef.current = false;
				}
			})();
		},
		[onAction],
	);

	return (
		<div className="min-w-0 space-y-3" data-openui-message>
			<OpenUIActionPendingContext.Provider
				value={actionState.status === "pending"}
			>
				<Renderer
					response={response}
					library={omaOpenUILibrary}
					isStreaming={isStreaming}
					onAction={handleAction}
					publishObservability={false}
				/>
			</OpenUIActionPendingContext.Provider>
			{actionState.status === "pending" && (
				<p role="status" className="text-xs font-mono text-accent">
					{actionState.label}…
				</p>
			)}
			{actionState.status === "success" && (
				<p role="status" className="text-xs font-mono text-success">
					{actionState.label}
				</p>
			)}
			{actionState.status === "error" && (
				<p
					role="alert"
					className="rounded-[var(--radius-sm)] border border-[var(--color-danger)]/40 bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-3 py-2 text-xs text-[var(--color-danger)]"
				>
					{actionState.message}
				</p>
			)}
		</div>
	);
}
