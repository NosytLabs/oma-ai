/** On-demand, read-only wallet balances. Never signs or transfers funds. */
import { Hono } from "hono";
import { erc20Abi, formatEther, formatUnits, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { USDC_BASE } from "../constants.js";
import { getPublicClient } from "../lib/rpc-client.js";
import { sessionOrBearerAuth, requireAdmin } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import type { OmaEnv } from "../types.js";

export const adminTreasuryRoutes = new Hono<OmaEnv>();
const readLimit = rateLimit({ windowMs: 60_000, maxRequests: 10, failClosed: false });

async function bounded<T>(operation: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	try {
		return await Promise.race([operation, new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error("Wallet balance check timed out")), 16_000);
		})]);
	} finally { clearTimeout(timer!); }
}

adminTreasuryRoutes.get("/v1/admin/treasury", sessionOrBearerAuth, requireAdmin(), readLimit, async c => {
	c.header("Cache-Control", "no-store");
	const facilitator = config.FACILITATOR_PRIVATE_KEY ? privateKeyToAccount(config.FACILITATOR_PRIVATE_KEY as `0x${string}`).address : null;
	const definitions = [
		{ role: "x402-recipient", label: "x402 treasury", address: config.TREASURY_BASE_ADDRESS || null },
		{ role: "deposit-recipient", label: "Direct USDC deposits", address: config.USDC_DEPOSIT_ADDRESS || null },
		{ role: "facilitator", label: "Facilitator · pays transaction gas", address: facilitator },
	];
	const cachedReads = new Map<string, Promise<{ eth: string; usdc: string }>>();
	const wallets = await Promise.all(definitions.map(async wallet => {
		if (!wallet.address || config.FACILITATOR_MODE !== "live") return { ...wallet, eth: null, usdc: null,
			error: wallet.address ? "Balances are not checked in mock mode." : "Address is not configured." };
		const address = wallet.address as Address;
		let pending = cachedReads.get(address.toLowerCase());
		if (!pending) {
			const client = getPublicClient();
			pending = bounded(Promise.all([
				client.getBalance({ address }),
				client.readContract({ address: USDC_BASE as Address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
			]).then(([eth, usdc]) => ({ eth: formatEther(eth), usdc: formatUnits(usdc, 6) })));
			cachedReads.set(address.toLowerCase(), pending);
		}
		try { return { ...wallet, ...await pending, error: null }; }
		catch { return { ...wallet, eth: null, usdc: null, error: "Base RPC balance check failed. Retry or inspect the address on the explorer." }; }
	}));
	return c.json({ mode: config.FACILITATOR_MODE, network: "Base mainnet", checkedAt: new Date().toISOString(), wallets });
});
