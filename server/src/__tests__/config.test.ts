import { describe, expect, it } from "vitest";
import {
	getPolarConfigurationErrors,
	getX402ProviderConfigurationErrors,
} from "../config.js";

describe("getPolarConfigurationErrors", () => {
	it("requires the webhook secret and every credit product when cards are enabled", () => {
		expect(
			getPolarConfigurationErrors({
				POLAR_ACCESS_TOKEN: "polar_access_token",
				POLAR_WEBHOOK_SECRET: undefined,
				POLAR_HOBBY_PRODUCT_ID: "hobby",
				POLAR_BUILDER_PRODUCT_ID: undefined,
				POLAR_SCALE_PRODUCT_ID: undefined,
			}),
		).toEqual([
			"POLAR_WEBHOOK_SECRET",
			"POLAR_BUILDER_PRODUCT_ID",
			"POLAR_SCALE_PRODUCT_ID",
		]);
	});

	it("accepts a complete card rail configuration", () => {
		expect(
			getPolarConfigurationErrors({
				POLAR_ACCESS_TOKEN: "polar_access_token",
				POLAR_WEBHOOK_SECRET: "polar_webhook_secret",
				POLAR_HOBBY_PRODUCT_ID: "hobby",
				POLAR_BUILDER_PRODUCT_ID: "builder",
				POLAR_SCALE_PRODUCT_ID: "scale",
			}),
		).toEqual([]);
	});
});

describe("getX402ProviderConfigurationErrors", () => {
	it("rejects the unsupported QuickNode settlement delegation", () => {
		expect(
			getX402ProviderConfigurationErrors({
				X402_FACILITATOR_PROVIDER: "quicknode",
			}),
		).toEqual(["X402_FACILITATOR_PROVIDER=quicknode"]);
	});
});
