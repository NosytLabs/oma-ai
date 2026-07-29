import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ account, chain: base, transport: http() });

const domain = "oma-ai.com";
const walletAddress = account.address;
const chainId = 8453;

async function main() {
  // Step 1: Get nonce — send walletAddress + chainId
  console.log("Step 1: GET nonce for", walletAddress);
  const nonceRes = await fetch("http://localhost:3401/api/auth/siwe/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, chainId }),
  });
  const nonceData = await nonceRes.json();
  console.log("Nonce response:", JSON.stringify(nonceData));
  const nonce = nonceData.nonce;
  if (!nonce) {
    console.log("❌ No nonce returned");
    return;
  }

  // Step 2: Build EIP-4361 message
  const message = `${domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nSign in to OMA AI\n\nURI: https://${domain}\nVersion: 1\nChain ID: 8453\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

  // Step 3: Sign
  const signature = await walletClient.signMessage({ message });
  console.log("Signature:", signature);

  // Step 4: Verify — send walletAddress + chainId + message + signature
  console.log("Step 4: VERIFY");
  const verifyRes = await fetch("http://localhost:3401/api/auth/siwe/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature, walletAddress, chainId }),
    redirect: "manual",
  });
  console.log("Verify status:", verifyRes.status);
  const setCookie = verifyRes.headers.get("set-cookie");
  console.log("Set-Cookie:", setCookie?.slice(0, 120));

  // Step 5: Get session using the cookie
  if (setCookie) {
    const sessionRes = await fetch("http://localhost:3401/api/auth/session", {
      headers: { Cookie: setCookie },
    });
    console.log("Session status:", sessionRes.status);
    if (sessionRes.status === 200) {
      const session = await sessionRes.json();
      console.log("Session user:", JSON.stringify(session.user));
      console.log("✅ SIWE E2E SUCCESS — wallet linked, session created");
    } else {
      const body = await sessionRes.text();
      console.log("Session body:", body.slice(0, 300));
    }
  } else {
    console.log("❌ No session cookie — SIWE failed at verify step");
  }
}

main().catch(console.error);
