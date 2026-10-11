import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";
import { BodyTooLargeError, readTextWithinLimit } from "@/lib/read-body";

/**
	* HTTP JSON-RPC proxy for Base wallet clients.
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

const ALLOWED: Record<Chain, { id: number; fallbacks: string[] }> = {
	base: { id: 8453, fallbacks: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"] },
	"base-sepolia": { id: 84532, fallbacks: ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"] },
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
]);

// Hard body cap (16 KB). JSON-RPC bodies are normally <2 KB; anything
// bigger is either a malicious payload (OOM on the Next runtime) or a
// batch spam attack on the upstream's compute budget.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;

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

	let body: unknown;
	try {
		body = JSON.parse(await readTextWithinLimit(request, MAX_BODY_BYTES));
	} catch (error) {
		if (error instanceof BodyTooLargeError) return NextResponse.json({ error: {
			message: `JSON-RPC body exceeds ${MAX_BODY_BYTES}-byte limit`, type: "payload_too_large",
		} }, { status: 413 });
		return NextResponse.json(
			{ error: { message: "Invalid JSON-RPC body", type: "validation_error" } },
			{ status: 400 },
		);
	}

	const incoming = Array.isArray(body) ? body : [body];
	if (incoming.length === 0) return NextResponse.json({ error: { message: "JSON-RPC batch cannot be empty", type: "validation_error" } }, { status: 400 });
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
			!("jsonrpc" in msg) || msg.jsonrpc !== "2.0" ||
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

	// Reads may fail over. A batch containing a broadcast gets one attempt:
	// a dropped response does not prove that the transaction was rejected.
	const readOnly = incoming.every(msg => msg.method !== "eth_sendRawTransaction");
	const upstreams = resolveUpstreams(chain);
	for (const upstream of readOnly ? upstreams : upstreams.slice(0, 1)) {
		if (request.signal.aborted) break;
		try {
			const resp = await fetch(upstream, {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body), cache: "no-store",
				signal: AbortSignal.any([request.signal, AbortSignal.timeout(5_000)]),
			});
			if (!resp.ok) { await resp.body?.cancel(); continue; }
			if (resp.status === 204) return new NextResponse(null, { status:204, headers:{ "Cache-Control":"no-store" } });
			const text = await readTextWithinLimit(resp, MAX_RESPONSE_BYTES);
			const reply = JSON.parse(text);
			const replies = Array.isArray(reply) ? reply : [reply];
			if (!replies.length || replies.some(msg => !msg || msg.jsonrpc !== "2.0")) continue;
			if (readOnly && replies.some(msg => [-32603, -32005, 429].includes(msg.error?.code))) continue;
			if (!Array.isArray(body) && incoming[0].method === "eth_chainId" && reply.result && Number(reply.result) !== ALLOWED[chain].id) continue;
			return new NextResponse(text, { status:resp.status, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });
		} catch {
			// Keep upstream credentials and raw transport diagnostics server-side.
		}
	}
	return NextResponse.json({ error: { message: "RPC temporarily unavailable. Please retry.", type: "upstream_error" } }, { status:502, headers:{ "Cache-Control":"no-store" } });
}

export async function POST(
	request: Request,
	context: { params: Promise<{ chain: string }> },
): Promise<NextResponse> {
	return withRateLimit((req: Request) => handleRpc(req, context), RATE_LIMIT)(
		request,
	) as Promise<NextResponse>;
}

function resolveUpstreams(chain: Chain): string[] {
	const urls = [process.env[`${chainKey(chain)}_RPC_URL`], ...ALLOWED[chain].fallbacks];
	return [...new Set(urls.filter((url): url is string => {
		if (!url || /placeholder|changeme/i.test(url)) return false;
		try { return ["https:", "http:"].includes(new URL(url).protocol); } catch { return false; }
	}))];
}

function chainKey(chain: Chain): string {
	return chain === "base" ? "BASE" : "BASE_SEPOLIA";
}
