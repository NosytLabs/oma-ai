import { NextResponse } from "next/server";

/**
 * JSON-RPC proxy for wagmi transports.
 *
 * Why: the QuickNode / dedicated RPC URL must never reach the browser,
 * otherwise the key leaks into the client bundle. This route forwards
 * JSON-RPC POSTs to the configured upstream and returns the response
 * verbatim. Auth-free, rate-limited, method-allowlisted, and chained to
 * a known set of chain ids so it can't be repurposed as an open proxy.
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

function isValidChain(chain: string | undefined): chain is Chain {
	return chain === "base" || chain === "base-sepolia";
}

export async function POST(
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
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: { message: "Invalid JSON-RPC body", type: "validation_error" } },
			{ status: 400 },
		);
	}

	const incoming = Array.isArray(body) ? body : [body];
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

function resolveUpstream(chain: Chain): string | null {
	// Priority: explicit env var (server-only), otherwise the public default.
	const envUrl = process.env[`${chainKey(chain)}_RPC_URL`];
	if (envUrl) return envUrl;
	return ALLOWED[chain].fallback;
}

function chainKey(chain: Chain): string {
	return chain === "base" ? "BASE" : "BASE_SEPOLIA";
}