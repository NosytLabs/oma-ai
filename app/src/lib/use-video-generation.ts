"use client";

import { useToast } from "@/components/ui/Toast";
import { buildAuthHeaders } from "@/lib/cookies";
import { useCallback, useRef, useState } from "react";

export type VideoGenerationRequest = {
	model: string;
	prompt: string;
	seconds?: number;
	size?: string;
	imageUrl?: string | null;
};

export type VideoJob = {
	id: string;
	status: "queued" | "in_progress" | "succeeded" | "failed" | "cancelled";
	url?: string;
	error?: string;
};

const GENERATE_URL = "/api/v1/videos/generations";
const RETRIEVE_URL = "/api/v1/videos/retrieve";

/**
 * Shared video-generation flow. Both the standalone /video-generation
 * page and the chat VideoGenerationPanel drive their requests through
 * this hook so the polling lifecycle, error mapping, and auth headers
 * stay aligned.
 */
export function useVideoGeneration() {
	const toast = useToast();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [job, setJob] = useState<VideoJob | null>(null);
	// Always cancel the previous poller before starting a new one. Without
	// this, two generations in flight can fight over the same job state.
	const pollHandleRef = useRef<{ cancelled: boolean } | null>(null);

	const cancel = useCallback(() => {
		if (pollHandleRef.current) pollHandleRef.current.cancelled = true;
		pollHandleRef.current = null;
	}, []);

	const generate = useCallback(
		async (req: VideoGenerationRequest): Promise<VideoJob | null> => {
			setLoading(true);
			setError(null);
			cancel();

			const handle = { cancelled: false };
			pollHandleRef.current = handle;

			try {
				const resp = await fetch(GENERATE_URL, {
					method: "POST",
					credentials: "include",
					headers: buildAuthHeaders({
						"Content-Type": "application/json",
					}),
					body: JSON.stringify({
						model: req.model,
						prompt: req.prompt,
						seconds: req.seconds,
						size: req.size,
						image: req.imageUrl ?? undefined,
					}),
				});

				if (resp.status === 401) {
					throw new Error("Connect your wallet to generate a video");
				}
				if (!resp.ok) {
					const errBody = (await resp.json().catch(() => null)) as {
						error?: { message?: string };
					} | null;
					throw new Error(
						errBody?.error?.message || `HTTP ${resp.status}`,
					);
				}

				const created = (await resp.json()) as {
					id: string;
					status: VideoJob["status"];
				};
				const initial: VideoJob = { id: created.id, status: created.status };
				setJob(initial);

				// Poll until terminal. Cancellable via `cancel()`.
				while (!handle.cancelled) {
					if (
						initial.status === "succeeded" ||
						initial.status === "failed" ||
						initial.status === "cancelled"
					) {
						break;
					}
					await new Promise((r) => setTimeout(r, 3000));
					if (handle.cancelled) break;

					const poll = await fetch(
						`${RETRIEVE_URL}?id=${encodeURIComponent(initial.id)}`,
						{
							credentials: "include",
							headers: buildAuthHeaders(),
						},
					);
					if (!poll.ok) {
						throw new Error(`Polling failed: HTTP ${poll.status}`);
					}
					const update = (await poll.json()) as VideoJob;
					setJob(update);
					if (
						update.status === "succeeded" ||
						update.status === "failed" ||
						update.status === "cancelled"
					) {
						if (update.status === "succeeded") {
							toast.success("Video ready");
						} else if (update.status === "failed") {
							toast.error(update.error ?? "Video generation failed");
						}
						return update;
					}
				}
				return handle.cancelled ? null : initial;
			} catch (err) {
				if (!handle.cancelled) {
					const msg = err instanceof Error ? err.message : "Generation failed";
					setError(msg);
					toast.error(msg);
				}
				return null;
			} finally {
				if (pollHandleRef.current === handle) {
					pollHandleRef.current = null;
				}
				if (!handle.cancelled) setLoading(false);
			}
		},
		[cancel, toast],
	);

	return { generate, cancel, loading, error, job, setError };
}
