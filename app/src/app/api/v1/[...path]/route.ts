import { proxy } from "@/lib/api/proxy-handler";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
	* Catch-all proxy for /api/v1/* — forwards any request not handled by a
	* specific route (models, privacy) straight to the Hono backend.
	*
	* The frontend API client (`@/lib/api`) rewrites every `/v1/*` call to the
	* same-origin `/api/v1/*` path, so every backend endpoint that lacks a
	* dedicated Next route used to 404 before ever reaching Hono (balance,
	* usage, export, videos, ...). This route forwards method, body, cookies
	* and preserves the rate-limit / daily-limit headers the UI reads.
	*/

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
