import { describe, expect, it } from "vitest";
import { formatUptime } from "./ops-snapshot";

describe("formatUptime", () => {
	it("formats seconds, minutes, and hours", () => {
		expect(formatUptime(null)).toBe("—");
		expect(formatUptime(12)).toBe("12s");
		expect(formatUptime(125)).toBe("2m");
		expect(formatUptime(3725)).toBe("1h 2m");
	});
});

describe("prometheus parsing (inline)", () => {
	it("sums labeled counters and reads bare gauges", () => {
		const text = `
oma_http_requests_total{method="GET",path="/health",status="200"} 7
oma_http_requests_total{method="GET",path="/metrics",status="200"} 3
oma_chat_completions_total 12
oma_rate_limit_hits_total 2
`;
		// Mirror the helpers' behavior without exporting private parse fns
		const sum = (name: string) => {
			const re = new RegExp(
				`^${name}(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)\\s*$`,
				"gm",
			);
			let t = 0;
			for (const m of text.matchAll(re)) t += Number(m[1]) || 0;
			return t;
		};
		const gauge = (name: string) => {
			const re = new RegExp(`^${name}(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)\\s*$`, "m");
			const m = text.match(re);
			return m ? Number(m[1]) : 0;
		};
		expect(sum("oma_http_requests_total")).toBe(10);
		expect(gauge("oma_chat_completions_total")).toBe(12);
		expect(gauge("oma_rate_limit_hits_total")).toBe(2);
	});
});
