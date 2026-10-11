import { describe, expect, it } from "vitest";
import { accountSettingsHref, legacySettingsHref } from "./account-navigation";

describe("unified account navigation", () => {
	it.each(["profile", "appearance", "sessions", "danger"])("keeps bookmarked %s settings and demo isolation", section => {
		const url = new URL(legacySettingsHref(new URLSearchParams(`demo=1&source=tour&tab=${section}`)), "https://www.oma-ai.com");
		expect(url.pathname).toBe("/dashboard");
		expect(Object.fromEntries(url.searchParams)).toEqual({ demo: "1", source: "tour", tab: "settings", section });
	});
	it.each([["privacy", "danger"], ["data", "danger"], ["theme", "appearance"]])("maps legacy %s aliases", (alias, section) => {
		expect(legacySettingsHref(new URLSearchParams(`tab=${alias}`))).toBe(`/dashboard?tab=settings&section=${section}`);
	});
	it.each(["keys", "api-keys"])("opens %s in the API keys tab", tab => {
		expect(legacySettingsHref(new URLSearchParams(`demo=1&tab=${tab}`))).toBe("/dashboard?demo=1&tab=api-keys");
	});
	it("supports hash bookmarks and falls back safely for unknown sections", () => {
		expect(legacySettingsHref(new URLSearchParams(), "#sessions")).toBe("/dashboard?tab=settings&section=sessions");
		expect(accountSettingsHref("invalid")).toBe("/dashboard?tab=settings&section=profile");
	});
});
