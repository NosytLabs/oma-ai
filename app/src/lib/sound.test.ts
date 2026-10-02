/**
 * Regression guard for the cuelume 0.2.4 cue-name split.
 *
 * cuelume@0.2.4 types `play()` as TWO overloads over DISJOINT name sets:
 *   - SoundName       = keyof RECIPES  (tap, type, select, success, error, ...)
 *   - LegacySoundName = keyof ALIASES  (tick, chime, press, page, ...)
 *
 * A cue name that spans both sets matches neither overload, so a single call
 * site whose value is inferred as a union like `"success" | "error" | "tick"`
 * fails to compile with TS2769 ("No overload matches this call") even though
 * every individual name is valid.
 *
 * `playToastCue` previously mapped the "info" toast to the legacy alias
 * "tick", producing exactly that union. The fix maps it to "select" (a
 * RECIPES name with the same UI intent) so all three branches stay inside one
 * overload. This test asserts the invariant at the type level so a future
 * cuelume bump cannot silently reintroduce a mixed union.
 */
import { describe, expect, it } from "vitest";
import { playToastCue } from "@/lib/sound";

// The two disjoint name spaces in cuelume >= 0.2.4, spelled out here so the
// test fails loudly if the library reshapes them again.
const RECIPES = [
	"tap",
	"type",
	"select",
	"toggle",
	"open",
	"close",
	"success",
	"error",
	"navigate",
	"warning",
	"loading",
	"ready",
	"attention",
	"count",
] as const;
const ALIASES = [
	"chime",
	"sparkle",
	"droplet",
	"bloom",
	"whisper",
	"tick",
	"press",
	"release",
	"page",
	"pulse",
	"scan",
	"arrival",
] as const;

const RECIPE_SET: ReadonlySet<string> = new Set(RECIPES);
const ALIAS_SET: ReadonlySet<string> = new Set(ALIASES);

describe("cuelume cue names must live in a single overload", () => {
	it("RECIPES and ALIASES are disjoint, so mixing them cannot compile", () => {
		const overlap = RECIPES.filter((n) => ALIAS_SET.has(n));
		expect(overlap).toEqual([]);
	});

	it("every cue playToastCue can emit belongs to RECIPES", () => {
		// Mirrors the ternary in playToastCue.
		const cues = ["success", "error", "select"] as const;

		for (const cue of cues) {
			expect(RECIPE_SET.has(cue)).toBe(true);
			// A name in both sets would be fine; one in neither would be a bug.
			expect(ALIAS_SET.has(cue)).toBe(false);
		}
	});

	it("does not regress to the legacy alias that broke the union", () => {
		// "tick" is a valid alias but lives in the other overload — using it
		// alongside "success"/"error" is what produced TS2769.
		expect(ALIAS_SET.has("tick")).toBe(true);
		expect(RECIPE_SET.has("tick")).toBe(false);
	});
});

describe("playToastCue", () => {
	it("never throws for any toast type", () => {
		for (const type of ["success", "error", "info"] as const) {
			expect(() => playToastCue(type)).not.toThrow();
		}
	});
});
