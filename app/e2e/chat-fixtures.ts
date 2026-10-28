import { test as base, expect, type Page, type Route } from "@playwright/test";

// Complete public /v1/models entries, matching server/src/routes/models.ts.
// Deliberately use the three real free-chat IDs; no test can reach a provider.
//
// GLM-5.3 (zai-org-glm-5-3) and DeepSeek V4 Flash (deepseek-v4-flash-0731-
// openbroker) are TEMPORARILY PAUSED in the product: server/inference/model-
// catalog.json sets a disabledReason, server/src/routes/models.ts reports
// `available:false` (providerAvailable, models.ts:77), and the frontend
// mirrors the pause so both surfaces agree. So a guest sees exactly ONE
// selectable free model (MiniMax M2.7) plus a "temporarily unavailable"
// notice. These entries mirror that intended state truthfully.
const MODEL_CATALOG = {
	object: "list",
	data: [
		{
			id: "zai-org-glm-5-3", object: "model", created: 1791489600,
			owned_by: "OMA-AI", display_name: "GLM-5.3 Flash", provider: "OMA-AI",
			category: "frontier", modality: "chat", context_length: 202752,
			supports_streaming: true, supports_tools: true, capabilities: ["tools"],
			available: false,
			unavailable_reason: "Temporarily paused after repeated upstream output. Please choose MiniMax M2.7.",
			pricing: { prompt: 1, completion: 3.2 },
		},
		{
			id: "deepseek-v4-flash-0731-openbroker", object: "model", created: 1791489600,
			owned_by: "OMA-AI", display_name: "DeepSeek V4 Flash", provider: "OMA-AI",
			category: "budget", modality: "chat", context_length: 131072,
			supports_streaming: true, supports_tools: true, capabilities: ["tools"],
			available: false,
			unavailable_reason: "Temporarily paused after repeated upstream output. Please choose MiniMax M2.7.",
			pricing: { prompt: 0.14, completion: 0.28 },
		},
		{
			id: "minimax-m2-7", object: "model", created: 1791489600,
			owned_by: "OMA-AI", display_name: "MiniMax M2.7", provider: "OMA-AI",
			category: "mid", modality: "chat", context_length: 196608,
			supports_streaming: true, supports_tools: true, capabilities: ["tools"],
			available: true, pricing: { prompt: 0.3, completion: 1.2 },
		},
	],
};

interface CompletionRequest {
	model: string;
	stream: boolean;
	messages: Array<{ role: string; content: string }>;
	[key: string]: unknown;
}

interface PendingCompletion {
	started: Promise<void>;
	release: () => Promise<void>;
}

interface ChatApi {
	userId: string | null;
	switchAccount: (userId: string | null) => Promise<void>;
	requests: CompletionRequest[];
	replyNext: (content: string) => void;
	holdNextCompletion: () => PendingCompletion;
}

type Reply = { kind: "reply"; content: string } | { kind: "hold"; receive: (route: Route) => void };

function completionStream(model: string, content: string): string {
	const common = { id: "chatcmpl-browser-fixture", object: "chat.completion.chunk", created: 1791489600, model };
	const frames = [
		{ ...common, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] },
		{ ...common, choices: [{ index: 0, delta: { content }, finish_reason: null }] },
		{ ...common, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
		{ ...common, choices: [], usage: { prompt_tokens: 12, completion_tokens: 16, total_tokens: 28 } },
	];
	return frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") + "data: [DONE]\n\n";
}

export const test = base.extend<{ chatApi: ChatApi }>({
	chatApi: [async ({ page, baseURL }, use) => {
		if (!baseURL) throw new Error("Chat tests require a local baseURL.");
		const appOrigin = new URL(baseURL).origin;
		const requests: CompletionRequest[] = [];
		const replies: Reply[] = [];
		const pendingRoutes = new Set<Route>();
		const unexpectedRequests: string[] = [];
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));

		await page.emulateMedia({ reducedMotion: "reduce" });

		await page.route("**/*", async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.origin !== appOrigin) {
				// Fonts/images/analytics cannot cause a paid inference call or
				// send test activity to a live external service.
				if (/\/(?:api\/)?(?:v1|auth)\//.test(url.pathname)) unexpectedRequests.push(request.url());
				await route.abort("blockedbyclient");
				return;
			}
			if (!url.pathname.startsWith("/api/")) {
				await route.continue();
				return;
			}
			if (url.pathname === "/api/auth/get-session") {
				const id = chatApi.userId;
				await route.fulfill({ status: 200, json: id ? { user: { id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }, session: { id: `session-${id}`, userId: id, token: "synthetic", expiresAt: "2099-01-01T00:00:00Z" } } : null });
				return;
			}
			if (url.pathname === "/api/v1/models") {
				await route.fulfill({ status: 200, json: MODEL_CATALOG });
				return;
			}
			if (url.pathname === "/api/v1/usage/today") {
				await route.fulfill({ status: 200, json: { limit: 20, used: 0, remaining: 20 } });
				return;
			}
			if (url.pathname === "/api/v1/site-settings") {
				await route.fulfill({ status: 200, json: { maintenanceMode: false, maintenanceMessage: null } });
				return;
			}
			if (url.pathname === "/api/v1/balance") {
				if (chatApi.userId) { await route.fulfill({ json: { balanceCents: "1000", totalDepositedCents: "1000", totalUsedCents: "0", lastActivityAt: null } }); return; }
				// A guest has no account balance. Do not fake a signed-in balance
				// if a background refresh asks for this endpoint.
				await route.fulfill({ status: 401, json: { error: { message: "Authentication required", type: "authentication_error" } } });
				return;
			}
			if (url.pathname === "/api/health") {
				await route.fulfill({ status: 200, json: { status: "ok" } });
				return;
			}
			// The chat playground posts to the same-origin Next proxy
			// (/api/chat/completions), NOT the public /api/v1 path. Matching the
			// public path only meant every real chat request fell through to the
			// "unexpected API call" branch and the suite failed on its own
			// fixture, not on a product bug.
			if ((url.pathname === "/api/chat/completions" || url.pathname === "/api/v1/chat/completions") && request.method() === "POST") {
				const body = request.postDataJSON() as CompletionRequest;
				expect(["zai-org-glm-5-3", "deepseek-v4-flash-0731-openbroker", "minimax-m2-7"]).toContain(body.model);
				// The browser must never impersonate the website proxy: the Next
				// proxy strips any client X-OMA-Source and sets its own.
				expect(request.headers()["x-oma-source"]).toBeUndefined();
				requests.push(body);
				const reply = replies.shift();
				if (!reply) {
					unexpectedRequests.push("Completion sent without an explicit test reply");
					await route.fulfill({ status: 500, json: { error: { message: "No completion fixture queued" } } });
					return;
				}
				if (reply.kind === "hold") {
					pendingRoutes.add(route);
					reply.receive(route);
					return;
				}
				await route.fulfill({
					status: 200,
					headers: {
						"content-type": "text/event-stream; charset=utf-8",
						"cache-control": "no-cache",
						"x-actual-model": body.model,
						"x-dailylimit-limit": "20",
						"x-dailylimit-remaining": String(20 - requests.length),
					},
					body: completionStream(body.model, reply.content),
				});
				return;
			}
			unexpectedRequests.push(`${request.method()} ${url.pathname}`);
			await route.fulfill({ status: 501, json: { error: { message: "Unexpected API call in frontend test" } } });
		});

		const chatApi: ChatApi = {
			userId: null,
			switchAccount: async userId => {
				chatApi.userId = userId;
				const response = page.waitForResponse(result => new URL(result.url()).pathname === "/api/auth/get-session");
				await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
				expect((await (await response).json())?.user?.id ?? null).toBe(userId);
			},
			requests,
			replyNext: (content) => replies.push({ kind: "reply", content }),
			holdNextCompletion: () => {
				let resolveStarted!: () => void;
				let heldRoute: Route | undefined;
				const started = new Promise<void>((resolve) => { resolveStarted = resolve; });
				replies.push({ kind: "hold", receive: (route) => {
					heldRoute = route;
					resolveStarted();
				} });
				return {
					started,
					release: async () => {
						await started;
						if (heldRoute && pendingRoutes.delete(heldRoute)) await heldRoute.abort("aborted");
					},
				};
			},
		};
		try {
			await use(chatApi);
		} finally {
			for (const route of pendingRoutes) await route.abort("aborted");
		}
		expect(unexpectedRequests, "All API calls must use an explicit frontend fixture").toEqual([]);
		expect(pageErrors, "The chat flow must not produce an unhandled browser error").toEqual([]);
	}, { auto: true }],
});

export { expect };

export async function openChat(page: Page) {
	await page.goto("/chat");
	await expect(page.getByRole("textbox", { name: "Enter your message", exact: true })).toBeVisible();
	await expect(page.getByText("Free chat", { exact: true })).toBeVisible();
	await expect(page.getByText("20 free left", { exact: true })).toBeVisible();
}
