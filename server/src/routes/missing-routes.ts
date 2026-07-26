// Compat routes for OpenAPI spec entries that point at a path we don't
// physically mount under that name.
//
// Audit 2026-06-15: the spec declares /v1/api-keys but the real handler
// lives at /keys (mounted in routes/auth.ts). To keep spec-driven clients
// honest, we return a 410 Gone with a `correct_path` field rather than a
// silent 404 or a generic 501 — clients can read the body and switch to
// the real endpoint with no guesswork.
//
// /v1/x402/proxy (and its /chat/completions child) are 410s — the
// direct x402 chat proxy was removed with the Houdini/crosschain flow
// (see x402/facilitator.ts). Point callers at the supported path:
// /v1/chat/completions with an API key, or /v1/x402/verify + /settle
// for the payment envelope.
//
// ponytail: we do NOT delegate here. routes/auth.ts mounts `/keys/*`
// directly inside `authRoutes`; extracting a sub-router would touch a
// lot of code for a compat-only path. A 410 with the correct_path hint
// is the right cost/value trade.
import { Hono } from "hono";
import type { Context } from "hono";
import type { OmaEnv } from "../types.js";

export const missingRoutes = new Hono<OmaEnv>();

const gone = (
	c: Context<OmaEnv>,
	correctPath: string,
	message: string,
) =>
	c.json(
		{
			error: {
				message,
				type: "gone",
				correct_path: correctPath,
			},
		},
		410,
	);

missingRoutes.all("/v1/api-keys", (c) =>
	gone(c, "/keys", "Use /keys (mounted in routes/auth.ts)."),
);
missingRoutes.all("/v1/api-keys/*", (c) =>
	gone(c, "/keys", "Use /keys (mounted in routes/auth.ts)."),
);
// Clients that invent `/v1/keys` (OpenAPI-style prefix) hit a hard 404
// without this — same correct_path hint as /v1/api-keys.
missingRoutes.all("/v1/keys", (c) =>
	gone(c, "/keys", "Use /keys (mounted in routes/auth.ts)."),
);
missingRoutes.all("/v1/keys/*", (c) =>
	gone(c, "/keys", "Use /keys (mounted in routes/auth.ts)."),
);
missingRoutes.all("/v1/x402/proxy", (c) =>
	gone(
		c,
		"/v1/chat/completions",
		"The x402 chat proxy was removed. Use POST /v1/chat/completions with an API key; x402 verify/settle live at /v1/x402/verify and /v1/x402/settle.",
	),
);
missingRoutes.all("/v1/x402/proxy/*", (c) =>
	gone(
		c,
		"/v1/chat/completions",
		"The x402 chat proxy was removed. Use POST /v1/chat/completions with an API key; x402 verify/settle live at /v1/x402/verify and /v1/x402/settle.",
	),
);
// Export lives under /v1/export/* (not /v1/usage/export).
missingRoutes.all("/v1/usage/export", (c) =>
	gone(c, "/v1/export/usage", "Use GET /v1/export/usage?format=csv|json."),
);
