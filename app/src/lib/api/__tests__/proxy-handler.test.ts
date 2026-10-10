// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy-handler";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("gateway proxy cancellation", () => {
	it("propagates caller cancellation and keeps a timeout longer than the backend budget", async () => {
		const caller = new AbortController();
		const timeout = vi.spyOn(AbortSignal, "timeout");
		const fetchMock = vi.fn((_url: URL, request: RequestInit) => new Promise<Response>((_resolve, reject) => {
			request.signal!.addEventListener("abort", () => reject(request.signal!.reason), { once: true });
		}));
		vi.stubGlobal("fetch", fetchMock);
		const pending = proxy(new NextRequest("https://www.oma-ai.com/api/v1/chat/completions", { method: "POST", signal: caller.signal }));
		caller.abort();
		const response = await pending;
		expect(response.status).toBe(499);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(timeout).toHaveBeenCalledWith(270_000);
	});
});
