import type { ReactNode } from "react";
import Link from "next/link";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { MODELS, formatPricePerMillion } from "@/lib/models-data";
import SITE_URL, { API_BASE, API_V1_BASE } from "@/lib/site";
import { DocsSearch } from "./_components/DocsSearch";
import { DocsShell } from "./DocsShell";
import { buildPublicOpenApiSpec } from "../../../../server/src/routes/openapi-spec";
import limits from "../../../../server/src/inference/api-limits.json";
import modelLimits from "../../../../server/src/middleware/rate-limit/model-limits.json";

const spec = buildPublicOpenApiSpec({
	publicApiUrl: API_BASE,
	localPort: 3001,
	nodeEnv: "production",
});
const contract = spec as unknown as {
	security: Security;
	paths: Record<string, Record<string, Operation>>;
	components: { schemas: Record<string, Schema> };
};
type Security = Record<string, string[]>[];
type Schema = {
	$ref?: string;
	type?: string | string[];
	description?: string;
	properties?: Record<string, Schema>;
	required?: string[];
	items?: Schema;
	[key: string]: unknown;
};
type Operation = {
	summary?: string;
	description?: string;
	security?: Security;
	parameters?: {
		name: string;
		in: string;
		required?: boolean;
		description?: string;
		schema?: Schema;
	}[];
	requestBody?: { content?: Record<string, { schema?: Schema }> };
	responses?: Record<
		string,
		{ description?: string; content?: Record<string, { schema?: Schema }> }
	>;
};
const anchors: Record<string, string> = {
	"POST /v1/chat/completions": "ep-chat",
	"POST /v1/messages": "ep-messages",
	"GET /v1/models": "ep-models",
	"GET /v1/models/{id}": "ep-model",
	"GET /user": "ep-user",
	"GET /sessions": "ep-sessions",
	"DELETE /sessions/{id}": "ep-session-revoke",
	"DELETE /sessions": "ep-sessions-revoke",
	"DELETE /v1/history": "ep-history-clear",
	"DELETE /account": "ep-account-delete",
	"GET /v1/search": "ep-search",
	"GET /v1/balance": "ep-balance",
	"GET /v1/credits/balance": "ep-credits-balance",
	"GET /v1/credits/transactions": "ep-credits-transactions",
	"GET /v1/deposit/usdc": "ep-deposit-usdc",
	"POST /v1/deposit/usdc": "ep-deposit-submit",
	"POST /v1/deposit/usdc/challenge": "ep-deposit-challenge",
	"GET /v1/deposit/status": "ep-deposit-status",
	"POST /v1/checkout": "ep-checkout",
	"GET /v1/usage/today": "ep-usage-today",
	"GET /v1/usage": "ep-usage",
	"GET /v1/usage/summary": "ep-usage-summary",
	"GET /v1/keys": "ep-keys-list",
	"POST /v1/keys": "ep-keys-create",
	"DELETE /v1/keys/{id}": "ep-keys-revoke",
	"GET /x402/info": "ep-x402-info",
	"POST /x402/verify": "ep-x402-verify",
	"POST /x402/settle": "ep-x402-settle",
};
const firstRequest = `curl --fail-with-body ${API_V1_BASE}/chat/completions \\
  -H "Authorization: Bearer $OMA_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"model":"minimax-m2-7","max_tokens":256,"messages":[{"role":"user","content":"Hello!"}]}'`;
const messagesRequest = `curl --fail-with-body ${API_V1_BASE}/messages \\
  -H "x-api-key: $OMA_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"model":"minimax-m2-7","max_tokens":256,"messages":[{"role":"user","content":"Hello!"}]}'`;
const streamingRequest = `curl --no-buffer --fail-with-body ${API_V1_BASE}/chat/completions \\
  -H "Authorization: Bearer $OMA_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"model":"minimax-m2-7","max_tokens":256,"stream":true,"messages":[{"role":"user","content":"Hello!"}]}'`;
function Code({ children }: { children: string }) {
	return (
		<pre className="my-4 overflow-x-auto rounded-xl border border-border bg-panel p-4 text-xs leading-relaxed">
			<code>{children}</code>
		</pre>
	);
}
function Section({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			className="scroll-mt-24 space-y-4 border-t border-border pt-8"
		>
			<h2 className="text-2xl font-semibold text-text-bright">{title}</h2>
			{children}
		</section>
	);
}
function resolve(schema: Schema): Schema {
	return schema.$ref
		? (contract.components.schemas[schema.$ref.split("/").at(-1)!] ?? schema)
		: schema;
}
function schemaSummary(schema: Schema): string {
	const kind =
		schema.$ref?.split("/").at(-1) ??
		(Array.isArray(schema.type)
			? schema.type.join(" or ")
			: (schema.type ?? "any JSON value"));
	const bounds = [
		["minimum", "min"],
		["exclusiveMinimum", "greater than"],
		["maximum", "max"],
		["exclusiveMaximum", "less than"],
		["format", "format"],
		["minItems", "min items"],
		["maxItems", "max items"],
		["minLength", "min length"],
		["maxLength", "max length"],
		["default", "default"],
	]
		.filter(([key]) => schema[key] !== undefined)
		.map(([key, label]) => `${label}: ${JSON.stringify(schema[key])}`);
	if (schema.enum)
		bounds.push(
			`allowed: ${(schema.enum as unknown[]).map((value) => JSON.stringify(value)).join(", ")}`,
		);
	if (schema.items?.$ref)
		bounds.push(`items: ${schema.items.$ref.split("/").at(-1)}`);
	return [kind, ...bounds].join(" · ");
}
function Fields({ schema }: { schema: Schema }) {
	const value = resolve(schema);
	if (!value.properties) return <Code>{JSON.stringify(value, null, 2)}</Code>;
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-sm">
				<thead>
					<tr>
						<th className="p-2">Field</th>
						<th className="p-2">Contract</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(value.properties).map(([key, field]) => (
						<tr key={key} className="border-t border-border align-top">
							<th className="p-2 font-mono font-normal">
								{key}
								{value.required?.includes(key) ? " *" : ""}
							</th>
							<td className="p-2">
								<p>{field.description}</p>
								<p className="font-mono text-xs text-text-muted">
									{schemaSummary(field)}
								</p>
								{Boolean(
									field.items ||
									field.properties ||
									field.oneOf ||
									field.anyOf ||
									field.pattern,
								) && (
									<details className="mt-2">
										<summary className="cursor-pointer text-xs text-accent">
											Full field schema
										</summary>
										<Code>{JSON.stringify(field, null, 2)}</Code>
									</details>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="mt-2 text-xs text-text-muted">
				* Required. JSON Schema keywords show accepted types and bounds.
			</p>
		</div>
	);
}
function authLabel(operation: Operation) {
	const security = operation.security ?? contract.security;
	return security.length === 0
		? "Public"
		: security
				.map((alternative) =>
					Object.keys(alternative)
						.map((name) =>
							name === "BearerAuth"
								? "Authorization: Bearer API key"
								: name === "ApiKeyHeader"
									? "x-api-key header"
									: name === "SessionCookie"
										? "Signed-in session cookie"
										: name,
						)
						.join(" + "),
				)
				.join(" or ");
}
function EndpointReference() {
	return (
		<div className="space-y-3">
			{Object.entries(contract.paths).flatMap(([path, item]) =>
				Object.entries(item)
					.filter(([method]) =>
						["get", "post", "delete", "put", "patch"].includes(method),
					)
					.map(([method, operation]) => {
						const key = `${method.toUpperCase()} ${path}`;
						return (
							<details
								key={key}
								id={
									anchors[key] ??
									`ep-${method}-${path.replace(/[^a-z0-9]+/gi, "-")}`
								}
								className="scroll-mt-24 rounded-xl border border-border p-4"
								open={key === "POST /v1/chat/completions"}
							>
								<summary className="cursor-pointer font-medium text-text">
									<code>{key}</code>
									<span className="mt-1 block text-sm text-text-secondary">
										{operation.summary}
									</span>
								</summary>
								<div className="mt-4 space-y-4 text-sm">
									<p className="font-mono text-xs text-accent">
										{authLabel(operation)}
									</p>
									{operation.description && <p>{operation.description}</p>}
									{operation.parameters?.map((parameter) => (
										<div key={`${parameter.in}-${parameter.name}`}>
											<h4 className="font-mono text-text">
												{parameter.in}: {parameter.name}
												{parameter.required ? " (required)" : " (optional)"}
											</h4>
											<p>{parameter.description}</p>
											<code className="text-xs">
												{schemaSummary(parameter.schema ?? {})}
											</code>
										</div>
									))}
									{Object.entries(operation.requestBody?.content ?? {}).map(
										([type, body]) => (
											<div key={type}>
												<h4 className="mb-2 font-medium text-text">
													Request, {type}
												</h4>
												{body.schema && <Fields schema={body.schema} />}
											</div>
										),
									)}
									<h4 className="font-medium text-text">Responses</h4>
									<dl className="space-y-2">
										{Object.entries(operation.responses ?? {}).map(
											([status, response]) => (
												<div key={status}>
													<dt className="inline font-mono text-accent">
														{status}{" "}
													</dt>
													<dd className="inline">
														{response.description}
														{Object.entries(response.content ?? {}).map(
															([type, body]) => (
																<p
																	key={type}
																	className="mt-1 font-mono text-xs text-text-muted"
																>
																	{type}
																	{body.schema &&
																	resolve(body.schema).properties
																		? ` · fields: ${Object.keys(resolve(body.schema).properties ?? {}).join(", ")}`
																		: ""}
																</p>
															),
														)}
													</dd>
												</div>
											),
										)}
									</dl>
									<a
										href="/api/v1/openapi.json"
										className="inline-block text-xs text-accent underline"
									>
										Complete request and response schemas, OpenAPI 3.1
									</a>
								</div>
							</details>
						);
					}),
			)}
		</div>
	);
}
export function DocsContent() {
	return (
		<DocsShell>
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Docs", url: "/docs" },
				]}
			/>
			<header className="mb-10 space-y-5">
				<p className="section-eyebrow-caps">Developer reference</p>
				<h1 className="display-headline text-text-bright">OMA API</h1>
				<p className="page-intro">
					Model discovery, chat completions and prepaid account credits.
				</p>
				<div className="flex flex-wrap gap-4">
					<DocsSearch />
					<Link href="/dashboard?tab=api-keys" className="btn-mono btn-primary">
						Create an API key
					</Link>
					<a href="/api/v1/openapi.json" className="btn-mono">
						OpenAPI 3.1
					</a>
				</div>
				<p className="text-sm text-text-muted">
					The endpoint reference below uses the same contract as the
					downloadable OpenAPI document. Check{" "}
					<Link className="text-accent" href="/status">
						service status
					</Link>{" "}
					before testing sign-in or funding.
				</p>
			</header>
			<div className="space-y-12 text-sm leading-relaxed text-text-secondary">
				<Section id="quickstart" title="Quick start">
					<ol className="list-decimal space-y-2 pl-5">
						<li id="qs-step-key">
							Sign in, then create and save an API key in the dashboard.
						</li>
						<li id="qs-step-request">
							Add prepaid credits using an available method on Buy credits.
						</li>
						<li id="qs-step-response">
							Choose an available ID from the live catalog and send a request.
						</li>
					</ol>
					<Code>
						{`curl --fail-with-body ${API_V1_BASE}/models`}
					</Code>
					<p>
						Set <code>OMA_API_KEY</code> to your saved secret. Replace the
						example model if the live catalog reports it unavailable.
					</p>
					<Code>{firstRequest}</Code>
					<p>
						SDK base URL: <code>{API_V1_BASE}</code>. All
						API-key inference spends credits, including models offered free in
						website chat.
					</p>
				</Section>
				<Section id="authentication" title="Authentication">
					<p id="auth-key">
						Send <code>Authorization: Bearer $OMA_API_KEY</code>. The Messages
						endpoint also accepts <code>x-api-key</code>. Keep keys on your
						server. Create, list and revoke keys using a signed-in session, not
						another API key.
					</p>
					<p id="auth-magic">
						Email sign-in uses a magic link.{" "}
						<span id="auth-wallet">
							Wallet sign-in uses SIWE. Account, key-management and x402
							settlement routes require the session cookie specified in the
							endpoint reference.
						</span>
					</p>
					<p>
						Key expiry, model scope and IP restrictions are defined under{" "}
						<a className="text-accent" href="#ep-keys-create">
							POST /v1/keys
						</a>
						. Invalid explicit credentials are rejected instead of falling back
						to guest access. Cookie-authenticated mutations also require an
						allowed Origin or Referer. Browsers send it automatically; scripts
						must set Origin: {SITE_URL}.
					</p>
				</Section>
				<Section id="integrations" title="Client configuration">
					<p id="int-openai-sdk">
						For clients using Chat Completions, configure the base URL above and
						an OMA catalog model ID. The gateway does not implement the OpenAI
						Responses API.
					</p>
					<p id="int-claude-code">
						For the supported Anthropic Messages subset, use base URL{" "}
						<code>{API_BASE}</code> when the client appends{" "}
						<code>/v1/messages</code>. Text and function tools are supported;
						image/document blocks are rejected. Extended thinking and
						prompt-cache fields are ignored and not forwarded.
					</p>
					<Code>{messagesRequest}</Code>
					<p id="int-opencode">
						<span id="int-cursor">
							Client-specific configuration files vary by version. Configure the
							endpoint, key and model through that client&apos;s documented
							custom-provider settings.
						</span>
					</p>
				</Section>
				<Section id="endpoints" title="Endpoint reference">
					<p>
						Paths below are relative to <code>{API_BASE}</code>.
						Funding paths <code>/x402/*</code> are relative to{" "}
						<code>{SITE_URL}</code>. Optional fields, bounds,
						authentication and response formats are shown per operation.
					</p>
					<EndpointReference />
				</Section>
				<Section id="models" title="Model limits">
					<p>
						Limits below are the configured gateway limits. Provider
						verification and pricing sources are linked on each{" "}
						<Link href="/models" className="text-accent">
							model page
						</Link>
						. OMA/OpenBroker limits whose upstream API does not publish
						specifications are marked unverified there. Use the live model API
						for runtime availability and price overrides.
					</p>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr>
									<th className="p-2">API model ID</th>
									<th className="p-2">Context tokens</th>
									<th className="p-2">Max output tokens</th>
								</tr>
							</thead>
							<tbody>
								{MODELS.map((model) => (
									<tr className="border-t border-border" key={model.id}>
										<td className="p-2 font-mono">{model.id}</td>
										<td className="p-2">
											{model.contextTokens.toLocaleString("en-US")}
										</td>
										<td className="p-2">
											{(
												model.maxOutputTokens ?? model.contextTokens
											).toLocaleString("en-US")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p>
						Requested output must fit the selected model&apos;s output limit.
						Input plus requested output must fit the gateway context check; its
						input count is an estimate. A provider can reject a request that its
						tokenizer counts differently.
					</p>
				</Section>
				<Section id="provider-routing" title="Routing">
					<p id="pr-how">
						Select the exact API ID. The optional <code>models</code> array
						supplies up to eight fallback IDs. API-key restrictions apply to
						fallback routes. Inspect <code>x-actual-model</code> and the
						response model when a fallback serves the request.
					</p>
					<p id="pr-venice">
						Venice model privacy is shown per model as private or anonymized
						using the provider catalog.{" "}
						<span id="pr-oma-ai">
							OMA-AI routes use OpenBroker. Catalog availability describes
							configured access and pauses; it is not a guarantee of provider
							health.
						</span>
					</p>
				</Section>
				<Section id="streaming" title="Streaming">
					<p id="stream-how">
						Set <code>stream: true</code>. Chat Completions returns SSE data
						chunks and <code>[DONE]</code>. Messages uses Anthropic-shaped SSE
						events. An error after response headers can arrive inside the
						stream, so handle stream errors as well as HTTP failures.
					</p>
					<div id="stream-example">
						<Code>{streamingRequest}</Code>
					</div>
					<p id="stream-handling">
						Keep the response and <code>X-OMA-Request-ID</code>. Stop reading
						when your application cancels the request. A partial response can
						still incur usage charges.
					</p>
				</Section>
				<Section id="rate-limits" title="Rate limits">
					<div id="rl-limits">
						<p>
							Inference has a {limits.inferenceRequestsPerMinute}-request limit
							per 60 seconds by client IP. The default model limiter uses a{" "}
							{limits.bucketCapacity}-request bucket refilling at{" "}
							{limits.bucketRefillPerSecond} requests per second, with a{" "}
							{limits.inferenceRequestsPerMinute}-request sliding minute
							ceiling.
						</p>
						<p className="mt-3">
							The models below instead enforce independent model budgets by
							account, key and IP. Their token budget counts estimated input
							plus requested <code>max_tokens</code>, not actual billed usage.
						</p>
					</div>
					<div id="rl-models" className="overflow-x-auto">
						<table className="w-full text-left">
							<thead>
								<tr>
									<th className="p-2">Model</th>
									<th className="p-2">Requests/minute</th>
									<th className="p-2">Tokens/minute</th>
								</tr>
							</thead>
							<tbody>
								{Object.entries(modelLimits).map(([id, budget]) => (
									<tr className="border-t border-border" key={id}>
										<td className="p-2 font-mono text-xs">{id}</td>
										<td className="p-2">{budget.rpm}</td>
										<td className="p-2">
											{budget.tpm.toLocaleString("en-US")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p>
						When Redis is unavailable, the model limiter permits{" "}
						{limits.emergencyRequestsPerMinute} requests per minute per account
						and instance, or per IP for guests. Exhaustion returns 503. Script
						failures can use a bounded local counter;{" "}
						<code>X-RateLimit-Policy</code> includes{" "}
						<code>degraded-memory</code>.
					</p>
					<p>
						Eligible free website chat allows{" "}
						{limits.anonymousWebsiteRequestsPerDay} attempts per UTC day for
						guests by IP, or {limits.registeredWebsiteRequestsPerDay} for
						signed-in users. Attempts are reserved before inference and reset at
						UTC midnight. API keys bypass the free allowance and use paid
						credits. Exhaustion returns 429.
					</p>
					<p id="rl-headers">
						<code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>,{" "}
						<code>X-RateLimit-Reset</code> and <code>X-RateLimit-Policy</code>{" "}
						describe the current limiting layer. Reset is Unix seconds.{" "}
						<code>Retry-After</code> is seconds. Free chat also returns{" "}
						<code>X-DailyLimit-*</code>. Search and funding have separate limits
						in their operation descriptions.
					</p>
				</Section>
				<Section id="pricing" title="Pricing and billing">
					<p id="pricing-table">
						Prices are USD per million tokens. Live <code>/v1/models</code>{" "}
						returns the actual retail input/output rates and any
						extended-context tier. For a request, input cost plus output cost
						equals tokens divided by 1,000,000 times each applicable rate.
					</p>
					<p id="pricing-credits">
						Balances and charges use decimal-string cents, preserving fractional
						cents. Paid inference temporarily reserves the full configured
						input-context cost plus the requested output budget, including
						eligible fallback routes, before upstream work. A request can
						require more available credits than its final charge. Unused credits
						return after the cost is confirmed. Interrupted or uncertain
						requests can retain a budget for review. Use a reasonable{" "}
						<code>max_tokens</code> to bound cost. Free website chat and paid
						API usage are separate policies.
					</p>
					<p>
						A cash refund removes the corresponding prepaid credits. If those
						credits were spent or reserved, the account can have a credit
						shortfall. Spendable <code>balanceCents</code> stays at zero while
						<code>debtCents</code> reports the shortfall in decimal-string cents.
						Future top-ups first offset it before credits become available to
						spend.
					</p>
					<p>
						Current configured retail examples:{" "}
						{MODELS.slice(-3)
							.map(
								(m) =>
									`${m.id}: ${formatPricePerMillion(m.inputPricePer1M)} input / ${formatPricePerMillion(m.outputPricePer1M)} output`,
							)
							.join("; ")}
						. See{" "}
						<Link className="text-accent" href="/pricing">
							all prices
						</Link>
						.
					</p>
				</Section>
				<Section id="x402" title="x402 funding">
					<p id="x402-what">
						<strong className="text-text">
							POST /x402/verify moves money.
						</strong>{" "}
						It verifies a signed EIP-3009 authorization, broadcasts the USDC
						transfer and waits for confirmation. It is not a dry run. Base
						mainnet is the supported network.
					</p>
					<ol id="x402-flow" className="list-decimal space-y-2 pl-5">
						<li>
							Sign in with the paying wallet. Read the configured recipient,
							asset, network and signing domain from <code>/x402/info</code>.
						</li>
						<li>
							Sign an authorization using that exact recipient and amount. Send
							the base64 v2 envelope in <code>PAYMENT-SIGNATURE</code> to{" "}
							<code>/x402/verify</code>. Save any returned transaction hash,
							including one in a timeout response.
						</li>
						<li>
							Call <code>/x402/settle</code> with the hash, network ID and the
							payer&apos;s SIWE session. Settlement credits the confirmed
							transfer and does not send another payment.
						</li>
					</ol>
					<p id="x402-code">
						If crediting fails, retry settlement with the same hash and payer
						session. Inspect on-chain evidence before signing any replacement
						payment. A 409 reconciliation conflict requires support, not another
						payment. New funding fails closed when account/payment availability
						cannot be checked.
					</p>
					<p id="x402-where">
						Direct deposits can use a different treasury address. Always use the
						instructions returned by the chosen funding method. On-chain
						confirmation and account crediting are separate steps.
					</p>
				</Section>
				<Section id="sdks" title="Retries and tools">
					<p id="sdk-chat">
						Send <code>Idempotency-Key</code> for inference retries, up to 512
						UTF-8 bytes. Keys are scoped to the account across both formats. A
						duplicate in progress returns 409 <code>request_in_progress</code>{" "}
						with <code>Retry-After: 5</code>. A completed key returns 409{" "}
						<code>already_processed</code>, without replaying the body. Retain
						the original response.
					</p>
					<p id="sdk-tools">
						The application executes tools. Send the assistant tool calls and
						corresponding results back in the next request. Validate arguments
						and cap tool turns. Each model request uses its own budget and
						charge.
					</p>
					<p id="sdk-stream">
						<span id="sdk-models">Model discovery requires no key. </span>
						<span id="sdk-vercel">
							Choose a Chat Completions client rather than a client that
							requires the Responses API.
						</span>
					</p>
				</Section>
				<Section id="errors" title="Errors">
					<p id="err-format">
						Gateway errors generally use{" "}
						<code>{'{"error":{"message":"…","type":"…","code":"…"}}'}</code>.
						Some fields are optional. Validation errors can include{" "}
						<code>issues</code>; provider bodies and in-stream failures can
						differ.
					</p>
					<dl id="err-common" className="grid gap-3 sm:grid-cols-2">
						{[
							["400", "Invalid JSON, parameters or context/output budget."],
							[
								"401 / 403",
								"Missing credentials, invalid credentials or restricted access.",
							],
							["402", "Insufficient spendable credits."],
							["404", "Unknown model or route."],
							["409", "Retry-key or payment reconciliation conflict."],
							["429", "Rate or daily limit reached."],
							["502 / 504", "Provider or transport failure, or timeout."],
							["503", "Required service, model or funding method unavailable."],
						].map(([status, text]) => (
							<div key={status}>
								<dt className="font-mono text-accent">{status}</dt>
								<dd>{text}</dd>
							</div>
						))}
					</dl>
					<p id="err-retry">
						Honor <code>Retry-After</code> and cap retries. Do not retry invalid
						requests unchanged. Do not authorize another payment to fix a
						settlement conflict. Report the inference request ID when asking for
						help.
					</p>
				</Section>
			</div>
		</DocsShell>
	);
}
