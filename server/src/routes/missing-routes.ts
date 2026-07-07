// Compat routes for OpenAPI spec entries that point at a path we don't
// physically mount under that name.
//
// Audit 2026-06-15: the spec declares /v1/api-keys but the real handler
// lives at /keys (mounted in routes/auth.ts). To keep spec-driven clients
// honest, we return a 410 Gone with a `correct_path` field rather than a
// silent 404 or a generic 501 — clients can read the body and switch to
// the real endpoint with no guesswork.
//
// /v1/x402/proxy is also a 410 — the spec documents it as a future
// direct-proxy placeholder; the real proxy is at
// /v1/x402/proxy/chat/completions.
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
missingRoutes.all("/v1/x402/proxy", (c) =>
	gone(
		c,
		"/v1/x402/proxy/chat/completions",
		"Use POST /v1/x402/proxy/chat/completions for the x402 chat proxy.",
	),
);
