// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { shouldBuild } from "../../../scripts/vercel-ignore.mjs";

const base = "abcdef1234567";

function gitWithChanges(paths: string[]) {
	return vi.fn()
		.mockReturnValueOnce({ status: 0, stdout: "/repo\n" })
		.mockReturnValueOnce({ status: 0, stdout: paths.map((path) => `${path}\0`).join("") });
}

describe("Vercel frontend build decision", () => {
	it.each([
		"server/src/inference/model-catalog.json",
		"server/src/inference/api-limits.json",
		"server/src/middleware/rate-limit/model-limits.json",
		"server/src/routes/openapi-spec.ts",
		"server/src/middleware/origin-guard-paths.json",
		"patches/braces@3.0.3.patch",
		"vercel.json",
		"app/src/app/page.tsx",
		"pnpm-lock.yaml",
	])("builds when %s changes", (path) => {
		expect(shouldBuild(base, gitWithChanges([path]))).toBe(true);
	});

	it.each([
		[["server/src/routes/health.ts"]],
		[["docs/DEPLOYMENT.md", "README.md"]],
		[[]],
	])("skips unrelated changes: %j", (paths) => {
		expect(shouldBuild(base, gitWithChanges(paths))).toBe(false);
	});

	it("fails open when the prior SHA is absent or invalid", () => {
		const git = vi.fn();
		for (const sha of [undefined, "", "not-a-sha", "abc123"]) {
			expect(shouldBuild(sha, git)).toBe(true);
		}
		expect(git).not.toHaveBeenCalled();
	});

	it("fails open when git cannot locate the repository or diff the prior SHA", () => {
		expect(shouldBuild(base, vi.fn().mockReturnValue({ status: null, stdout: null }))).toBe(true);
		expect(shouldBuild(base, vi.fn()
			.mockReturnValueOnce({ status: 0, stdout: "/repo\n" })
			.mockReturnValueOnce({ status: 128, stdout: "" }))).toBe(true);
	});

	it("passes the previous SHA and HEAD to a NUL-delimited git diff", () => {
		const git = gitWithChanges([]);
		shouldBuild(base, git);
		expect(git).toHaveBeenNthCalledWith(2, "git", ["-C", "/repo", "diff", "--name-only", "-z", base, "HEAD"], { encoding: "utf8" });
	});
});
