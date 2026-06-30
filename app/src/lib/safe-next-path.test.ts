import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
	describe("happy paths", () => {
		it("returns the path unchanged for a simple same-origin path", () => {
			expect(safeNextPath("/dashboard")).toBe("/dashboard");
		});

		it("preserves query strings and fragments", () => {
			expect(safeNextPath("/playground?model=claude&tab=chat")).toBe(
				"/playground?model=claude&tab=chat",
			);
			expect(safeNextPath("/dashboard#usage")).toBe("/dashboard#usage");
		});

		it("preserves nested paths", () => {
			expect(safeNextPath("/dashboard/api-keys")).toBe("/dashboard/api-keys");
		});

		it("accepts a single slash root", () => {
			expect(safeNextPath("/")).toBe("/");
		});

		it("uses a custom fallback when provided", () => {
			expect(safeNextPath(null, "/home")).toBe("/home");
			expect(safeNextPath(undefined, "/home")).toBe("/home");
		});
	});

	describe("rejects protocol-relative URLs", () => {
		it("blocks //evil.com", () => {
			expect(safeNextPath("//evil.com")).toBe("/dashboard");
		});

		it("blocks //evil.com/dashboard", () => {
			expect(safeNextPath("//evil.com/dashboard")).toBe("/dashboard");
		});

		it("blocks /// (extra slashes)", () => {
			expect(safeNextPath("///evil.com")).toBe("/dashboard");
		});

		it("blocks //user@evil.com (userinfo trick)", () => {
			expect(safeNextPath("//user@evil.com")).toBe("/dashboard");
		});
	});

	describe("rejects backslash tricks", () => {
		it("blocks /\\evil.com", () => {
			expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
		});

		it("blocks backslash anywhere in the path", () => {
			expect(safeNextPath("/dashboard\\evil.com")).toBe("/dashboard");
		});

		it("blocks /%5Cevil.com (single-encoded backslash)", () => {
			// URLSearchParams.get() decodes %5C → \, so the result lands in our
			// hands already-decoded and the backslash check catches it.
			expect(safeNextPath("/%5Cevil.com")).toBe("/dashboard");
		});
	});

	describe("rejects double-encoded bypasses", () => {
		it("blocks /%252F%252Fevil.com (double-encoded //)", () => {
			// First decode yields "/%2F%2Fevil.com".
			// Second decode surfaces "//evil.com" → fallback.
			expect(safeNextPath("/%252F%252Fevil.com")).toBe("/dashboard");
		});

		it("blocks mixed /%252F%5Cevil.com (double-/ + single-\\)", () => {
			// After recursive decode: "//\\evil.com" — caught by either
			// the // check or the backslash check on the fully-decoded form.
			expect(safeNextPath("/%252F%5Cevil.com")).toBe("/dashboard");
		});

		it("blocks double-encoded slashes that would resolve to //", () => {
			// `/%252Fdashboard` recursively decodes to `/%2Fdashboard`
			// (one layer), then to `//dashboard` (two layers). The
			// fully-decoded form starts with `//` → caught.
			expect(safeNextPath("/%252Fdashboard")).toBe("/dashboard");
		});

		it("allows truly harmless double-encoded sequences", () => {
			// `/dashboard%2520foo` decodes to `/dashboard%20foo` (one
			// layer), then to `/dashboard foo` (two layers). The
			// fully-decoded form is a same-origin path → allowed, and
			// we return the original (still-encoded) form to preserve
			// user intent.
			expect(safeNextPath("/dashboard%2520foo")).toBe("/dashboard%2520foo");
		});
	});

	describe("rejects non-path schemes", () => {
		it("blocks javascript: URLs", () => {
			expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
		});

		it("blocks data: URLs", () => {
			expect(safeNextPath("data:text/html,<script>alert(1)</script>")).toBe(
				"/dashboard",
			);
		});

		it("blocks http(s) absolute URLs", () => {
			expect(safeNextPath("https://evil.com")).toBe("/dashboard");
			expect(safeNextPath("http://evil.com")).toBe("/dashboard");
		});
	});

	describe("rejects malformed input", () => {
		it("returns fallback for null", () => {
			expect(safeNextPath(null)).toBe("/dashboard");
		});

		it("returns fallback for undefined", () => {
			expect(safeNextPath(undefined)).toBe("/dashboard");
		});

		it("returns fallback for empty string", () => {
			expect(safeNextPath("")).toBe("/dashboard");
		});

		it("returns fallback for non-string input", () => {
			// `unknown`-via-cast to exercise the runtime guard without
			// tripping the `no-explicit-any` rule.
			expect(safeNextPath(123 as unknown as string)).toBe("/dashboard");
			expect(safeNextPath({} as unknown as string)).toBe("/dashboard");
			expect(safeNextPath([] as unknown as string)).toBe("/dashboard");
		});

		it("returns fallback for control-character-only input", () => {
			expect(safeNextPath("\r\n\t")).toBe("/dashboard");
			expect(safeNextPath("\x00")).toBe("/dashboard");
		});

		it("strips control characters from a valid path", () => {
			// The leading control char should be stripped, then the path is valid.
			expect(safeNextPath("/dashboard\x00")).toBe("/dashboard");
			expect(safeNextPath("\n/dashboard")).toBe("/dashboard");
		});

		it("returns fallback when malformed percent-encoding hides a protocol-relative URL", () => {
			// The raw string starts with `//` and contains a malformed
			// percent-encoding (`%E0` with no leading char). `decodeURIComponent`
			// throws, so the function falls back to validating the raw string
			// itself — which starts with `//` and is caught.
			expect(safeNextPath("//evil.com%E0")).toBe("/dashboard");
		});

		it("rejects overlong UTF-8 slash encodings (defense in depth)", () => {
			// `%c0%af` and friends are IE6/7-era overlong UTF-8 encodings of
			// `/`. Modern browsers reject them in URL paths, but defense in
			// depth says reject them up front. The first decode throws
			// (invalid UTF-8), and the input contains a percent-byte pattern
			// → caught.
			expect(safeNextPath("/%c0%af")).toBe("/dashboard");
			expect(safeNextPath("/%c0%2f")).toBe("/dashboard");
			expect(safeNextPath("/%C0%AF")).toBe("/dashboard");
		});

		it("rejects overlong UTF-8 backslash encodings", () => {
			// `%E0%80%AF` is an overlong UTF-8 encoding of `\`.
			expect(safeNextPath("/%E0%80%AF")).toBe("/dashboard");
			expect(safeNextPath("/%e0%80%af")).toBe("/dashboard");
		});

		it("rejects mixed overlong UTF-8 in a sub-path", () => {
			expect(safeNextPath("/foo/%c0%af/bar")).toBe("/dashboard");
		});

		it("accepts a trailing lone percent as a same-origin path", () => {
			// `/dashboard%` is not an open-redirect — the browser treats the
			// lone `%` as a literal character in the path. The function
			// preserves the input rather than failing.
			expect(safeNextPath("/dashboard%")).toBe("/dashboard%");
		});

		it("rejects paths longer than 2 KiB", () => {
			const huge = `/${"a".repeat(3000)}`;
			expect(safeNextPath(huge)).toBe("/dashboard");
		});
	});

	describe("defense in depth — never throws", () => {
		it("does not throw on weird Unicode", () => {
			expect(() => safeNextPath("/🚀")).not.toThrow();
			expect(() => safeNextPath("/日本語")).not.toThrow();
		});
	});
});
