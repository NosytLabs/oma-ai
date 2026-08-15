import { type NextRequest } from "next/server";
import { proxy } from "@/lib/api/proxy-handler";

export const runtime = "nodejs";

/**
	* Catch-all proxy for non-/api/v1 backend endpoints.
	*
	* The frontend API client (`@/lib/api`) sends every browser call to the
	* same origin under `/api/*` so the HttpOnly session cookie is forwarded.
	* Most of those land under `/api/v1/*` and are handled by
	* `app/api/v1/[...path]`, but Better-Auth-flavored endpoints
	* (`/user`, `/sessions`, `/account`, ...) live at the API root and used
	* to 404 before ever reaching Hono. This route forwards method, body,
	* cookies and preserves the rate-limit / daily-limit headers the UI
	* reads. Specific routes (auth, health, pricing, rpc, support, v1) take
	* precedence over this catch-all in the App Router.
	*/

export async function GET(req: NextRequest) {
	return proxy(req);
}

export async function POST(req: NextRequest) {
	return proxy(req);
}

export async function PUT(req: NextRequest) {
	return proxy(req);
}

export async function PATCH(req: NextRequest) {
	return proxy(req);
}

export async function DELETE(req: NextRequest) {
	return proxy(req);
}
