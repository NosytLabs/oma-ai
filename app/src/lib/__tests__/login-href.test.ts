import { describe, expect, it } from "vitest";
import { buildLoginHref, safeLoginNext } from "../login-href";

describe("sign-in return destinations", () => {
	it.each(["/chat?model=claude-opus-5", "/dashboard?tab=api-keys", "/models?search=deepseek&tier=budget", "/docs#endpoints"])("preserves the full destination: %s", (path) => {
		expect(new URL(buildLoginHref(path), "https://www.oma-ai.com").searchParams.get("next")).toBe(path);
	});
	it("keeps the original destination when sign-in is opened from the sign-in page", () => {
		expect(buildLoginHref("/login?next=%2Fchat%3Fmodel%3Dclaude-opus-5")).toBe(buildLoginHref("/chat?model=claude-opus-5"));
	});
	it.each(["/login", "/login/", "/login?next=/login", "/account/../login", "//evil.example", "https://evil.example", "/\\evil.example", "/\t/evil.example"])("rejects looping or external return destinations: %s", (path) => {
		expect(safeLoginNext(path)).toBe("/dashboard");
	});
	it("does not unwrap a nested login loop", () => {
		expect(buildLoginHref("/login?next=%2Flogin%3Fnext%3D%2Flogin")).toBe("/login?next=%2Fdashboard");
	});
});
