import type { NextRequest } from "next/server";
import { proxy } from "@/lib/api/proxy-handler";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Sponsored website chat is separate from the prepaid public SDK API. */
export function POST(req: NextRequest) {
	return proxy(req, { websiteChat: true });
}
