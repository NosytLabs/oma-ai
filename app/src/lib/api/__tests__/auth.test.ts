import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock("../client.js", () => ({ request: requestMock }));

import { auth } from "../auth";

describe("auth API cancellation", () => {
	beforeEach(() => {
		requestMock.mockReset().mockResolvedValue({ success: true });
	});

	it("forwards an optional caller signal through every chat-key repair step", async () => {
		const controller = new AbortController();

		await auth.listKeys(controller.signal);
		await auth.createKey("Browser chat", controller.signal);
		await auth.installKeyCookie("oma_sk_test", controller.signal);

		expect(requestMock).toHaveBeenNthCalledWith(1, "/v1/keys", {
			signal: controller.signal,
		});
		expect(requestMock).toHaveBeenNthCalledWith(2, "/v1/keys", {
			method: "POST",
			body: JSON.stringify({ name: "Browser chat" }),
			signal: controller.signal,
		});
		expect(requestMock).toHaveBeenNthCalledWith(3, "/v1/keys/install", {
			method: "POST",
			body: JSON.stringify({ key: "oma_sk_test" }),
			signal: controller.signal,
		});
	});
});
