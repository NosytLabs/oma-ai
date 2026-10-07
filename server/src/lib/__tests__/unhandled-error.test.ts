import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";
import { ProviderError } from "../../inference/provider-route.js";
import { handleUnhandledError } from "../unhandled-error.js";
vi.mock("../logger.js", () => ({ logger: { error: vi.fn() } }));

function request(error: Error) {
    const app = new Hono<OmaEnv>();
    app.onError(handleUnhandledError);
    app.get("/", (c) => { c.set("correlationId", "audit-request"); throw error; });
    return app.request("/");
}

describe("unhandled errors", () => {
    it("keeps internal details in logs and returns the request ID", async () => {
        const response = await request(new Error("database password=private-detail"));
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: { message: "Internal server error", type: "server_error", correlationId: "audit-request" } });
    });
    it("preserves the safe provider error and retry status", async () => {
        const response = await request(new ProviderError("Inference provider temporarily unavailable", 503));
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ error: { message: "Inference provider temporarily unavailable" } });
    });
});
