import { proxy } from "@/lib/api/proxy-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The public payment endpoints need the same cookie and trusted-header
// handling as /api/*; an external rewrite bypasses that policy.
export const GET = proxy;
export const POST = proxy;
