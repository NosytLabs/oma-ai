import { describe, expect, it } from "vitest";
import {
	DEFAULT_THEME,
	isValidTheme,
	THEME_BOOTSTRAP_SCRIPT,
	THEME_IDS,
	THEME_STORAGE_KEY,
} from "./themes";
import { THEME_LIST } from "@/components/ThemeProvider";

describe("theme catalog", () => {
	it("accepts exactly the picker themes", () => {
		for (const id of THEME_IDS) expect(isValidTheme(id)).toBe(true);
		expect(isValidTheme("neon")).toBe(false);
		expect(isValidTheme("")).toBe(false);
		expect(isValidTheme(null)).toBe(false);
	});

	it("keeps the default inside the id list", () => {
		// The inline script branches on the default (it removes data-theme
		// rather than setting it), so a default outside THEME_IDS would make
		// the pre-paint bootstrap silently skip every stored theme.
		expect(THEME_IDS).toContain(DEFAULT_THEME);
	});

	it("has a picker entry for every id", () => {
		expect(THEME_LIST.map((t) => t.id).sort()).toEqual([...THEME_IDS].sort());
	});
});

describe("pre-paint bootstrap script", () => {
	it("is interpolated from the shared ids, not a hardcoded chain", () => {
		// Regression guard: the script used to hardcode
		// t==='emerald'||t==='amber'||t==='mono'||t==='synth', so adding a
		// theme to the picker silently dropped the visitor's stored choice.
		for (const id of THEME_IDS) {
			expect(THEME_BOOTSTRAP_SCRIPT).toContain(id);
		}
		expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
		expect(THEME_BOOTSTRAP_SCRIPT).toContain(DEFAULT_THEME);
	});

	it("reads the same storage key ThemeProvider persists to", () => {
		expect(THEME_STORAGE_KEY).toBe("oma-theme");
		expect(THEME_BOOTSTRAP_SCRIPT).toContain("localStorage.getItem('oma-theme')");
	});

	it("is syntactically valid JavaScript", () => {
		// A malformed inline script is silently ignored by the browser, which
		// means a theme flash on every load — so parse it.
		expect(() => new Function(THEME_BOOTSTRAP_SCRIPT)).not.toThrow();
	});
});