import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());

afterEach(() => vi.unstubAllGlobals());

describe("signOut", () => {
	it("rejects a returned auth failure and does not navigate", async () => {
		const assign = vi.fn();
		vi.stubGlobal("window", { location: { origin: "https://www.oma-ai.com", assign } });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Session service unavailable" }), { status: 503, headers: { "content-type": "application/json" } })));
		const { signOut } = await import("../auth-client");
		await expect(signOut({ callbackURL: "/" })).rejects.toThrow("Session service unavailable");
		expect(assign).not.toHaveBeenCalled();
	});

	it("navigates to the callback only after a successful sign-out", async () => {
		const assign = vi.fn();
		vi.stubGlobal("window", { location: { origin: "https://www.oma-ai.com", assign } });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } })));
		const { signOut } = await import("../auth-client");
		await signOut({ callbackURL: "/" });
		expect(assign).toHaveBeenCalledWith("/");
	});

	it("honors disableRedirect for callers that control navigation", async () => {
		const assign = vi.fn();
		vi.stubGlobal("window", { location: { origin: "https://www.oma-ai.com", assign } });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } })));
		const { signOut } = await import("../auth-client");
		await signOut({ callbackURL: "/", disableRedirect: true });
		expect(assign).not.toHaveBeenCalled();
	});
});
