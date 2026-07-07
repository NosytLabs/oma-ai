"use client";

import { useToast } from "@/components/ui/Toast";
import { buildAuthHeaders } from "@/lib/cookies";
import { useCallback, useState } from "react";

export type ImageGenerationRequest = {
	model: string;
	prompt: string;
	count: number;
	size: string;
	style?: string | null;
};

export type ImageGenerationResult = {
	urls: string[];
};

const DEFAULT_API_URL = "/api/v1/images/generations";

/**
 * Shared image-generation request flow. Both the standalone
 * /image-generation page and the chat ImageGenerationPanel call this so
 * auth handling, error mapping, and toast behavior stay in lockstep.
 */
export function useImageGeneration(apiUrl: string = DEFAULT_API_URL) {
	const toast = useToast();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generate = useCallback(
		async (req: ImageGenerationRequest): Promise<ImageGenerationResult | null> => {
			setLoading(true);
			setError(null);

			const enhancedPrompt = req.style
				? `${req.prompt.trim()}, ${req.style} style`
				: req.prompt.trim();

			try {
				const resp = await fetch(apiUrl, {
					method: "POST",
					credentials: "include",
					headers: buildAuthHeaders({
						"Content-Type": "application/json",
					}),
					body: JSON.stringify({
						model: req.model,
						prompt: enhancedPrompt,
						n: req.count,
						size: req.size,
					}),
				});

				if (resp.status === 401) {
					throw new Error("Connect your wallet to generate an API key");
				}
				if (!resp.ok) {
					const errBody = (await resp.json().catch(() => null)) as {
						error?: { message?: string };
					} | null;
					throw new Error(
						errBody?.error?.message || `HTTP ${resp.status}`,
					);
				}

				const json = (await resp.json()) as {
					data?: { url: string }[];
				};
				const urls = (json.data ?? []).map((d) => d.url);
				if (urls.length > 0) {
					toast.success(
						`Generated ${urls.length} image${urls.length > 1 ? "s" : ""}`,
					);
				}
				return { urls };
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Generation failed";
				setError(msg);
				toast.error(msg);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[apiUrl, toast],
	);

	return { generate, loading, error, setError };
}
