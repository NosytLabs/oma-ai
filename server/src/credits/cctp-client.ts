import { createPublicClient, http, decodeFunctionData, type Hash } from "viem";
import { base, mainnet, arbitrum, optimism, polygon, avalanche } from "viem/chains";
import { config } from "../config.js";

type ViemChain = typeof base | typeof mainnet | typeof arbitrum | typeof optimism | typeof polygon | typeof avalanche;

function getViemChain(chain: CctpChain): ViemChain {
  switch (chain) {
    case "ethereum": return mainnet;
    case "avalanche": return avalanche;
    case "optimism": return optimism;
    case "arbitrum": return arbitrum;
    case "base": return base;
    case "polygon": return polygon;
    default: throw new Error(`Unsupported chain for viem: ${chain}`);
  }
}

const CCTP_SUPPORTED_CHAINS = [
  "ethereum",
  "avalanche",
  "optimism",
  "arbitrum",
  "polygon",
  "base",
] as const;

export type CctpChain = typeof CCTP_SUPPORTED_CHAINS[number];

export const CCTP_CHAIN_DOMAIN_IDS: Record<CctpChain, number> = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  base: 6,
  polygon: 7,
};

const FINALITY_CONFIRMATIONS = 12;

/**
 * H14: return the per-chain RPC URL configured by the operator, or
 * fall back to viem's default. In production, an explicit HTTPS
 * `CHAIN_RPC_URL_PER_CHAIN` is required to avoid unauthenticated
 * public RPC traffic.
 */
function chainRpcUrl(chain: CctpChain): string | undefined {
  const raw = config.CHAIN_RPC_URL_PER_CHAIN;
  if (!raw) return undefined;
  const map: Record<string, string> = {};
  for (const entry of raw.split(",")) {
    const [k, v] = entry.split(":");
    if (k && v) map[k.trim().toLowerCase()] = v.trim();
  }
  // Accept "ethereum" or "eth", etc.
  const aliasKey =
    chain === "ethereum" ? "eth" :
    chain === "avalanche" ? "avax" :
    chain === "optimism" ? "op" :
    chain === "arbitrum" ? "arb" :
    chain === "polygon" ? "matic" :
    chain;
  return map[chain] || map[aliasKey];
}

async function verifyTransactionFinality(
  chain: CctpChain,
  txHash: string,
): Promise<boolean> {
  try {
    const viemChain = getViemChain(chain);
    const rpc = chainRpcUrl(chain);
    const client = createPublicClient({
      chain: viemChain,
      transport: rpc ? http(rpc) : http(),
    });
    const receipt = await client.getTransactionReceipt({ hash: txHash as Hash });
    const currentBlock = await client.getBlockNumber();
    const confirmations = Number(currentBlock - receipt.blockNumber);
    return confirmations >= FINALITY_CONFIRMATIONS;
  } catch {
    return false;
  }
}

export interface CctpAttestation {
  status: "pending" | "complete";
  attestation: string;
  messageHash?: string;
  sourceDomain?: number;
  destinationDomain?: number;
  amount?: string;
  mintRecipient?: string;
}

export interface CctpVerifyResult {
  verified: boolean;
  sourceChain: CctpChain;
  burnTxHash: string;
  burnAmount: string;
  mintRecipient: string;
  messageHash: string;
}

const CIRCLE_API = config.CCTP_CIRCLE_API_URL;

export function normalizeChainName(chain: string): CctpChain | null {
  const c = chain.toLowerCase();
  const map: Record<string, CctpChain> = {
    ethereum: "ethereum",
    eth: "ethereum",
    avalanche: "avalanche",
    avax: "avalanche",
    optimism: "optimism",
    op: "optimism",
    arbitrum: "arbitrum",
    arb: "arbitrum",
    polygon: "polygon",
    matic: "polygon",
    base: "base",
  };
  return map[c] ?? null;
}

export async function verifyBurnTransaction(
  sourceChain: string,
  burnTxHash: string,
): Promise<CctpVerifyResult> {
  const chain = normalizeChainName(sourceChain);
  if (!chain) throw new Error(`Unsupported CCTP source chain: ${sourceChain}`);

  const sourceDomain = CCTP_CHAIN_DOMAIN_IDS[chain];
  const destDomain = config.CCTP_BASE_DOMAIN;

  const attResp = await fetch(
    `${CIRCLE_API}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`,
    { headers: { Accept: "application/json" } },
  );

  if (!attResp.ok) {
    if (attResp.status === 404) {
      return {
        verified: false,
        sourceChain: chain,
        burnTxHash,
        burnAmount: "0",
        mintRecipient: "",
        messageHash: "",
      };
    }
    throw new Error(`Circle attestation API error: ${attResp.status}`);
  }

  const attData = await attResp.json() as {
    messages: Array<{
      status: string;
      attestation: string;
      messageHash: string;
      sourceTxHash: string;
      amount: string;
      mintRecipient: string;
      sourceDomain: number;
      destinationDomain: number;
    }>;
  };

  const msg = attData.messages?.[0];
  if (!msg) {
    return {
      verified: false,
      sourceChain: chain,
      burnTxHash,
      burnAmount: "0",
      mintRecipient: "",
      messageHash: "",
    };
  }

  if (msg.status !== "complete") {
    return {
      verified: false,
      sourceChain: chain,
      burnTxHash,
      burnAmount: "0",
      mintRecipient: "",
      messageHash: msg.messageHash,
    };
  }

  if (Number(msg.destinationDomain) !== destDomain) {
    throw new Error(`Burn destination domain ${msg.destinationDomain} does not match Base domain ${destDomain}`);
  }

  // H13: re-derive mintRecipient + amount from the on-chain burn tx
  // via viem, then compare to the Circle-reported values. If they
  // disagree, refuse the deposit — this is the cross-check against
  // an attacker who compromises the Circle attestation API or replays
  // a stale attestation against a different recipient.
  let onChainMintRecipient: string;
  let onChainAmount: string;
  try {
    const derived = await deriveBurnFromSourceChain(chain, burnTxHash);
    onChainMintRecipient = derived.mintRecipient;
    onChainAmount = derived.amount;
  } catch (deriveErr) {
    throw new Error(
      `Failed to derive burn parameters from source-chain tx: ${
        deriveErr instanceof Error ? deriveErr.message : String(deriveErr)
      }`,
    );
  }
  if (onChainMintRecipient.toLowerCase() !== msg.mintRecipient.toLowerCase()) {
    throw new Error(
      `CCTP mint recipient mismatch: Circle says ${msg.mintRecipient}, on-chain tx says ${onChainMintRecipient}`,
    );
  }
  if (onChainAmount !== msg.amount) {
    throw new Error(
      `CCTP amount mismatch: Circle says ${msg.amount}, on-chain tx says ${onChainAmount}`,
    );
  }

  return {
    verified: true,
    sourceChain: chain,
    burnTxHash,
    burnAmount: msg.amount,
    mintRecipient: msg.mintRecipient,
    messageHash: msg.messageHash,
  };
}

/**
 * H13: independently re-fetch the burn tx from the source chain RPC
 * and decode the USDC `depositForBurn` calldata to recover the
 * `mintRecipient` and `amount`. Returns the hex 0x-prefixed recipient
 * and the raw integer amount as a string.
 */
async function deriveBurnFromSourceChain(
  chain: CctpChain,
  burnTxHash: string,
): Promise<{ mintRecipient: string; amount: string }> {
  const viemChain = getViemChain(chain);
  const rpc = chainRpcUrl(chain);
  const client = createPublicClient({
    chain: viemChain,
    transport: rpc ? http(rpc) : http(),
  });
  const tx = await client.getTransaction({ hash: burnTxHash as Hash });
  if (!tx) throw new Error(`Source-chain tx not found: ${burnTxHash}`);

  // TokenMessenger.depositForBurn(uint256 amount, uint32 destinationDomain,
  //   bytes32 mintRecipient, address burnToken) returns (uint64 nonce)
  // We attempt to decode the first 4-byte selector against a small
  // candidate ABI; on success the second arg (after the uint256 amount
  // and uint32 destinationDomain) is the bytes32 mintRecipient.
  const candidateAbis = [
    {
      name: "depositForBurn",
      type: "function",
      inputs: [
        { name: "amount", type: "uint256" },
        { name: "destinationDomain", type: "uint32" },
        { name: "mintRecipient", type: "bytes32" },
        { name: "burnToken", type: "address" },
      ],
      outputs: [{ name: "nonce", type: "uint64" }],
    },
  ] as const;
  try {
    const decoded = decodeFunctionData({ abi: candidateAbis, data: tx.input });
    if (decoded.functionName !== "depositForBurn") {
      throw new Error(`Unexpected function: ${decoded.functionName}`);
    }
    const [amount, , mintRecipientBytes32] = decoded.args as [bigint, number, `0x${string}`];
    const recipientHex = `0x${mintRecipientBytes32.slice(-40)}`;
    return { mintRecipient: recipientHex, amount: amount.toString() };
  } catch (decodeErr) {
    throw new Error(
      `Could not decode depositForBurn calldata: ${
        decodeErr instanceof Error ? decodeErr.message : String(decodeErr)
      }`,
    );
  }
}

export interface CctpAttestationVerifyResult {
  verified: boolean;
  error?: string;
  onChainAmount?: string;
}

/**
 * H-CCTP-1: Verify a CCTP deposit against Circle's attestation API before
 * crediting the user. Calls `/attestations/{messageHash}` to confirm the
 * attestation exists and is `complete`, then re-queries
 * `/v2/messages/{sourceDomain}?transactionHash={burnTxHash}` to confirm the
 * on-chain USDC amount matches the user's claim. Rejects deposits where
 * the attestation is missing, still pending, or where the on-chain amount
 * does not match — preventing fabricated messageHashes or stale
 * attestations from minting credits.
 */
export async function verifyCctpAttestation(
  messageHash: string,
  claimedAmountUsd: number,
  sourceDomain: number,
  burnTxHash: string,
): Promise<CctpAttestationVerifyResult> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(messageHash)) {
    return { verified: false, error: "Invalid CCTP messageHash: must be 0x-prefixed 64 hex chars" };
  }

  // Step 1: verify the attestation itself exists and is complete.
  const attResp = await fetch(
    `${CIRCLE_API}/attestations/${messageHash}`,
    { headers: { Accept: "application/json" } },
  );

  if (attResp.status === 404) {
    return { verified: false, error: "CCTP attestation not found for messageHash" };
  }
  if (!attResp.ok) {
    return { verified: false, error: `Circle attestation API error: ${attResp.status}` };
  }

  const attData = await attResp.json() as { status: string; attestation?: string };
  if (attData.status !== "complete") {
    return { verified: false, error: `CCTP attestation status is "${attData.status}", expected "complete"` };
  }

  // Step 2: verify the on-chain amount matches the user's claim.
  // The /attestations/{messageHash} endpoint does not include the amount,
  // so we cross-reference against /v2/messages/{sourceDomain}?transactionHash=...
  const msgResp = await fetch(
    `${CIRCLE_API}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`,
    { headers: { Accept: "application/json" } },
  );

  if (!msgResp.ok) {
    return { verified: false, error: `Circle messages API error: ${msgResp.status}` };
  }

  const msgData = await msgResp.json() as {
    messages: Array<{
      messageHash: string;
      amount: string;
      status: string;
    }>;
  };

  const msg = msgData.messages?.find(
    (m) => m.messageHash.toLowerCase() === messageHash.toLowerCase(),
  );
  if (!msg) {
    return { verified: false, error: "CCTP message not found for given messageHash" };
  }

  const onChainAmountUsd = Number(msg.amount) / 1e6;
  if (!Number.isFinite(onChainAmountUsd) || onChainAmountUsd <= 0) {
    return { verified: false, error: "CCTP on-chain amount invalid", onChainAmount: msg.amount };
  }
  if (Math.abs(onChainAmountUsd - claimedAmountUsd) > 0.01) {
    return {
      verified: false,
      error: `CCTP amount mismatch: claimed $${claimedAmountUsd}, on-chain is $${onChainAmountUsd.toFixed(2)}`,
      onChainAmount: msg.amount,
    };
  }

  return { verified: true, onChainAmount: msg.amount };
}

export async function waitForAttestation(
  sourceChain: string,
  burnTxHash: string,
  maxRetries?: number,
  intervalMs?: number,
): Promise<CctpAttestation> {
  const retries = maxRetries ?? 15;
  const interval = intervalMs ?? 5000;
  const chain = normalizeChainName(sourceChain);
  if (!chain) throw new Error(`Unsupported CCTP source chain: ${sourceChain}`);

  const sourceDomain = CCTP_CHAIN_DOMAIN_IDS[chain];

  for (let i = 0; i < retries; i++) {
    const response = await fetch(
      `${CIRCLE_API}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`,
      { headers: { Accept: "application/json" } },
    );

    if (response.status === 404) {
      if (i < retries - 1) await new Promise((r) => setTimeout(r, interval));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Attestation request failed: ${response.status}`);
    }

    const data = await response.json() as {
      messages: Array<{
        status: string;
        attestation: string;
        messageHash: string;
        sourceDomain: number;
        destinationDomain: number;
        amount: string;
        mintRecipient: string;
      }>;
    };

    const msg = data.messages?.[0];
    if (msg?.status === "complete") {
      let hasFinality = false;
      for (let j = 0; j < 12 && !hasFinality; j++) {
        hasFinality = await verifyTransactionFinality(chain, burnTxHash);
        if (!hasFinality && j < 11) {
          await new Promise((r) => setTimeout(r, interval));
        }
      }
      if (hasFinality) {
        return {
          status: "complete",
          attestation: msg.attestation,
          messageHash: msg.messageHash,
          sourceDomain: msg.sourceDomain,
          destinationDomain: msg.destinationDomain,
          amount: msg.amount,
          mintRecipient: msg.mintRecipient,
        };
      }
    }

    if (i < retries - 1) await new Promise((r) => setTimeout(r, interval));
  }

  return { status: "pending", attestation: "", messageHash: "" };
}

export function getCctpSupportedChains(): CctpChain[] {
  const configured = config.CCTP_SOURCE_CHAINS.split(",").map((c) => c.trim().toLowerCase());
  return CCTP_SUPPORTED_CHAINS.filter((c) => configured.includes(c));
}
