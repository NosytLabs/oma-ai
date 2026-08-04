import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

/**
 * JSON-RPC proxy for wagmi transports.
 *
 * Why: the QuickNode / dedicated RPC URL must never reach the browser,
 * otherwise the key leaks into the client bundle. This route forwards
 * JSON-RPC POSTs to the configured upstream and returns the response
 * verbatim. Auth-free, rate-limited, method-allowlisted, body-capped,
 * and chained to a known set of chain ids so it can't be repurposed
 * as an open proxy.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Chain = "base" | "base-sepolia";

const ALLOWED: Record<Chain, { id: number; fallback: string }> = {
	base: { id: 8453, fallback: "https://mainnet.base.org" },
	"base-sepolia": { id: 84532, fallback: "https://sepolia.base.org" },
};

// Methods we will refuse to proxy. Conservative allowlist of read + tx
// methods; everything else (admin, debug) is rejected to keep the surface
// narrow in case the upstream key has wider scope than expected.
const ALLOWED_METHODS = new Set([
	"eth_chainId",
	"eth_blockNumber",
	"eth_call",
	"eth_estimateGas",
	"eth_gasPrice",
	"eth_maxPriorityFeePerGas",
	"eth_feeHistory",
	"eth_getBalance",
	"eth_getBlockByHash",
	"eth_getBlockByNumber",
	"eth_getCode",
	"eth_getLogs",
	"eth_getStorageAt",
	"eth_getTransactionByHash",
	"eth_getTransactionCount",
	"eth_getTransactionReceipt",
	"eth_sendRawTransaction",
	"eth_subscribe",
	"eth_unsubscribe",
]);

// Hard body cap (16 KB). JSON-RPC bodies are normally <2 KB; anything
// bigger is either a malicious payload (OOM on the Next runtime) or a
// batch spam attack on the upstream's compute budget.
const MAX_BODY_BYTES = 16 * 1024;

// Hard batch cap (25). The JSON-RPC spec allows arbitrarily-large batches;
// we don't, because each entry fans out to an upstream RPC call.
const MAX_BATCH = 25;

// Per-IP rate limit. The upstream RPC is metered by QuickNode; without
// this guard an attacker can exhaust our QuickNode credits with a loop.
const RATE_LIMIT = {
	limiter: generalLimiter,
	route: "/api/rpc/[chain]",
};

function isValidChain(chain: string | undefined): chain is Chain {
	return chain === "base" || chain === "base-sepolia";
}

async function handleRpc(
	request: Request,
	context: { params: Promise<{ chain: string }> },
): Promise<NextResponse> {
	const { chain } = await context.params;
	if (!isValidChain(chain)) {
		return NextResponse.json(
			{ error: { message: "Unsupported chain", type: "validation_error" } },
			{ status: 400 },
		);
	}

	// Body size guard. Read as text first so we can enforce the cap
	// before json() tries to allocate a huge in-memory parse tree.
	const rawText = await request.text();
	if (rawText.length > MAX_BODY_BYTES) {
		return NextResponse.json(
			{
				error: {
					message: `JSON-RPC body exceeds ${MAX_BODY_BYTES}-byte limit`,
					type: "payload_too_large",
				},
			},
			{ status: 413 },
		);
	}

	let body: unknown;
	try {
		body = JSON.parse(rawText);
	} catch {
		return NextResponse.json(
			{ error: { message: "Invalid JSON-RPC body", type: "validation_error" } },
			{ status: 400 },
		);
	}

	const incoming = Array.isArray(body) ? body : [body];
	if (incoming.length > MAX_BATCH) {
		return NextResponse.json(
			{
				error: {
					message: `JSON-RPC batch size limited to ${MAX_BATCH} requests`,
					type: "payload_too_large",
				},
			},
			{ status: 413 },
		);
	}

	for (const msg of incoming) {
		if (
			!msg ||
			typeof msg !== "object" ||
			!("method" in msg) ||
			typeof (msg as { method: unknown }).method !== "string" ||
			!ALLOWED_METHODS.has((msg as { method: string }).method)
		) {
			return NextResponse.json(
				{
					error: {
						message: "Method not allowed by JSON-RPC proxy",
						type: "validation_error",
					},
				},
				{ status: 400 },
			);
		}
	}

	const upstream = resolveUpstream(chain);
	if (!upstream) {
		return NextResponse.json(
			{
				error: {
					message: "RPC upstream not configured",
					type: "upstream_unconfigured",
				},
			},
			{ status: 503 },
		);
	}

	try {
		const resp = await fetch(upstream, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(15_000),
			cache: "no-store",
		});
		const text = await resp.text();
		return new NextResponse(text, {
			status: resp.status,
			headers: {
				"Content-Type": resp.headers.get("Content-Type") ?? "application/json",
				"Cache-Control": "no-store",
			},
		});
	} catch {
		return NextResponse.json(
			{
				error: { message: "RPC upstream unreachable", type: "upstream_error" },
			},
			{ status: 502 },
		);
	}
}

export async function POST(
	request: Request,
	context: { params: Promise<{ chain: string }> },
): Promise<NextResponse> {
	return withRateLimit((req: Request) => handleRpc(req, context), RATE_LIMIT)(
		request,
	) as Promise<NextResponse>;
}

function resolveUpstream(chain: Chain): string | null {
	// Priority: explicit env var (server-only), otherwise the public default.
	const envUrl = process.env[`${chainKey(chain)}_RPC_URL`];
	if (envUrl) return envUrl;
	return ALLOWED[chain].fallback;
}

function chainKey(chain: Chain): string {
	return chain === "base" ? "BASE" : "BASE_SEPOLIA";
}