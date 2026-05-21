import { config } from "../config.js";

export const CCTP_SUPPORTED_CHAINS = [
  "solana",
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
  solana: 8,
};

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

function normalizeChainName(chain: string): CctpChain | null {
  const c = chain.toLowerCase();
  const map: Record<string, CctpChain> = {
    solana: "solana",
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

  return {
    verified: true,
    sourceChain: chain,
    burnTxHash,
    burnAmount: msg.amount,
    mintRecipient: msg.mintRecipient,
    messageHash: msg.messageHash,
  };
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

    if (i < retries - 1) await new Promise((r) => setTimeout(r, interval));
  }

  return { status: "pending", attestation: "", messageHash: "" };
}

export function getCctpSupportedChains(): CctpChain[] {
  const configured = config.CCTP_SOURCE_CHAINS.split(",").map((c) => c.trim().toLowerCase());
  return CCTP_SUPPORTED_CHAINS.filter((c) => configured.includes(c));
}
