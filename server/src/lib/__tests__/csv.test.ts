import { describe, expect, it } from "vitest";
import { toCsv } from "../csv.js";
describe("spreadsheet-safe CSV", () => {
	it.each(["=1+1", "+cmd|anything", "-1+2", "@SUM(A1)", "\t=1+1", "\r=1+1", "  =1+1"])("treats formula-like text %j as a literal", text => {
		expect(toCsv([{ value: text }])).toContain(`'${text}`);
	});
	it("retains numeric precision, negative amounts, UTC dates and escaping", () => {
		expect(toCsv([{ cents: "-0.00000600", at: new Date("2026-10-11T00:00:00Z"), text: 'a,"b"\rc' }]))
			.toBe('cents,at,text\r\n-0.00000600,2026-10-11T00:00:00.000Z,"a,""b""\rc"');
	});
});
