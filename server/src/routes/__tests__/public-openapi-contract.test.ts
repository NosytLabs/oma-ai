import { describe, expect, it } from "vitest";
import { buildPublicOpenApiSpec } from "../openapi-spec.js";
import { anthropicSchema } from "../anthropic/request.js";

const spec = buildPublicOpenApiSpec({ publicApiUrl: "http://localhost:3001", localPort: 3001, nodeEnv: "test" });

describe("public API contract matches implemented request protocols", () => {
	it("keeps model and infrastructure discovery public", () => {
		for (const path of ["/v1/models", "/v1/models/{id}", "/ready", "/version", "/health", "/v1/health"] as const) {
			expect(spec.paths[path].get.security).toEqual([]);
		}
		expect(spec.components.securitySchemes.ApiKeyHeader).toMatchObject({ type: "apiKey", name: "x-api-key", in: "header" });
	});

	it("documents signed deposit units, proof fields and the actual challenge envelope", () => {
		const challenge = spec.paths["/v1/deposit/usdc/challenge"].post.responses["200"].content["application/json"].schema;
		expect(challenge.required).toEqual(["token", "nonce", "expiresAt"]);
		expect(challenge.properties.expiresAt.type).toBe("integer");
		const submit = spec.paths["/v1/deposit/usdc"].post.requestBody.content["application/json"].schema;
		expect(submit.required).toEqual(["amountUsd", "txHash", "fromAddress", "challengeToken", "signature"]);
		expect(submit.properties.amountUsd).toMatchObject({ exclusiveMinimum: 0, maximum: 10000 });
		expect(spec.paths["/v1/deposit/status"].get).not.toHaveProperty("parameters");
	});

	it("requires a configured checkout plan and keeps provider product IDs internal", () => {
		const schema = spec.paths["/v1/checkout"].post.requestBody.content["application/json"].schema;
		expect(schema.required).toEqual(["plan"]);
		expect(schema.properties.plan.enum).toEqual(["hobby", "builder", "scale"]);
		expect(schema.properties).not.toHaveProperty("productId");
		expect(schema.properties).not.toHaveProperty("cancelUrl");
	});

	it("matches export format defaults and supported date filters", () => {
		expect(spec.paths["/v1/export/usage"].get.parameters.map(p => p.name)).toEqual(["format", "since", "until"]);
		expect(spec.paths["/v1/export/summary"].get.parameters.map(p => p.name)).toEqual(["format"]);
		for (const path of ["/v1/export/usage", "/v1/export/deposits", "/v1/export/summary"] as const) {
			expect(spec.paths[path].get.responses["200"].content).toHaveProperty("text/csv");
			expect(spec.paths[path].get.responses["200"].content).toHaveProperty("application/json");
		}
	});

	it("publishes completion and fallback bounds enforced by real HTTP validation", () => {
		const properties = spec.components.schemas.ChatCompletionRequest.properties;
		expect(properties.messages.minItems).toBe(1);
		expect(properties.max_tokens.minimum).toBe(1);
		expect(properties.models).toMatchObject({ maxItems: 8, items: { minLength: 1 } });
		expect(properties.temperature).toMatchObject({ minimum: 0, maximum: 2 });
		expect(properties.top_p).toMatchObject({ minimum: 0, maximum: 1 });
		const anthropic = spec.paths["/v1/messages"].post.requestBody.content["application/json"].schema;
		expect(anthropic.properties.temperature).toMatchObject({ minimum: 0, maximum: 1 });
		expect(anthropic.properties.messages.minItems).toBe(1);
		expect(anthropic.properties.tool_choice).toHaveProperty("oneOf");
		const base = { model: "google-gemma-4-31b-it", messages: [{ role: "user", content: "Check bounds" }], max_tokens: 1 };
		expect(anthropicSchema.safeParse({ ...base, temperature: 1 }).success).toBe(true);
		expect(anthropicSchema.safeParse({ ...base, temperature: 1.01 }).success).toBe(false);
		expect(anthropicSchema.safeParse({ ...base, tool_choice: "auto" }).success).toBe(false);
	});

	it("validates UUID key revocation paths before the database", () => {
		expect(spec.paths["/v1/keys/{id}"].delete.parameters[0].schema).toMatchObject({ type: "string", format: "uuid" });
		expect(spec.paths["/v1/keys/{id}"].delete.responses).toHaveProperty("400");
	});

	it("documents bounded usage and refund query filters", () => {
		const parameters = spec.paths["/v1/usage"].get.parameters;
		expect(parameters.find(p => p.name === "limit")?.schema).toMatchObject({ minimum: 1, maximum: 500 });
		expect(parameters.find(p => p.name === "model")?.schema).toMatchObject({ maxLength: 150 });
		expect(parameters.find(p => p.name === "cursor")?.schema).toMatchObject({ maxLength: 512 });
		expect(spec.paths["/v1/refunds"].get.parameters.find(p => p.name === "limit")?.schema).toMatchObject({ minimum: 1, maximum: 200 });
	});
});
