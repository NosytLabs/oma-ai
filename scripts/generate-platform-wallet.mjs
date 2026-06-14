#!/usr/bin/env node
// One-shot: generate a fresh hot-wallet keypair for the OMA platform.
// Prints the address (add to MetaMask) and the private key (save to 1Password / env var).
// Does NOT write to disk. Run once per environment.
//
//   node scripts/generate-platform-wallet.mjs
//
// WARNING: Anyone with the private key controls the wallet. The key is printed
// in plaintext to stdout. Do NOT commit it, paste it into chat, or screenshot
// the terminal. Save it directly to your password manager.

// Resolve viem from the server workspace (it's listed in server/package.json).
// This script is meant to be run from the repo root.
import { generatePrivateKey, privateKeyToAccount } from "../server/node_modules/viem/_esm/accounts/index.js";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("==========================================================");
console.log(" OMA PLATFORM HOT WALLET  (Base mainnet, chainId 8453)");
console.log("==========================================================");
console.log("");
console.log("Address:     ", account.address);
console.log("Private Key: ", privateKey);
console.log("");
console.log("Next steps:");
console.log("  1. Copy the Address into MetaMask (see docs/OWNER-ONBOARDING.md §3)");
console.log("  2. Save the Private Key in 1Password / Vault (never commit it)");
console.log("  3. Set TREASURY_BASE_ADDRESS = address in server/.env");
console.log("  4. Set FACILITATOR_PRIVATE_KEY = private key in server/.env (live mode)");
console.log("");
console.log("Delete this terminal scrollback when done.");
