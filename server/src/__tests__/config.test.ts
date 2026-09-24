import { describe, expect, it } from "vitest";
import {
	getPolarConfigurationErrors,
	getX402ProviderConfigurationErrors,
	getDeployedFunctionEnvError,
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

describe("getDeployedFunctionEnvError", () => {
	// This is the exact misconfiguration that took production sign-in offline
	// on 2026-09-24: the function was deployed with NODE_ENV=development.
	it("rejects a deployed function running in development mode", () => {
		const err = getDeployedFunctionEnvError({
			NODE_ENV: "development",
			NEON_FUNCTION: "1",
		});
		expect(err).toBeTruthy();
		expect(err).toContain("NODE_ENV=production");
	});

	it("rejects staging and preview too — a public function is production", () => {
		for (const nodeEnv of ["staging", "preview", "test"]) {
			expect(
				getDeployedFunctionEnvError({ NODE_ENV: nodeEnv, NEON_FUNCTION: "1" }),
			).toBeTruthy();
		}
	});

	it("accepts a production function", () => {
		expect(
			getDeployedFunctionEnvError({ NODE_ENV: "production", NEON_FUNCTION: "1" }),
		).toBeNull();
	});

	it("does not affect local development (no NEON_FUNCTION)", () => {
		expect(
			getDeployedFunctionEnvError({ NODE_ENV: "development", NEON_FUNCTION: undefined }),
		).toBeNull();
	});

	it("allows an explicit opt-out for a non-public preview function", () => {
		expect(
			getDeployedFunctionEnvError({
				NODE_ENV: "development",
				NEON_FUNCTION: "1",
				ALLOW_DEV_MODE_DEPLOY: "1",
			}),
		).toBeNull();
	});
});
