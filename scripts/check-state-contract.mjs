#!/usr/bin/env node
/**
 * State contract guard.
 *
 * The client and the server describe the same lifecycle in two files (one
 * per package). Types cannot cross the package boundary, so nothing in the
 * compiler stops the two lists from drifting: the server adds a status,
 * the client keeps rendering the old vocabulary, and the mismatch only shows
 * up as a wrong word in a dashboard table.
 *
 * This script reads both declarations and fails when they disagree. It is
 * intentionally dependency-free and file-based so it can run in CI without a
 * build step.
 *
 *   node scripts/check-state-contract.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The lifecycles that both sides must agree on.
 *
 * Every entry pairs a server module with its client mirror and names the
 * const object that holds the vocabulary. Adding a lifecycle to the server
 * without adding it to the client (or the other way round) fails here.
 */
export const STATE_CONTRACTS = [
	{
		name: "usage status",
		serverFile: "server/src/lib/usage-status.ts",
		appFile: "app/src/lib/api/usage-status.ts",
		constName: "USAGE_STATUS",
	},
	{
		name: "deposit status",
		serverFile: "server/src/lib/deposit-status.ts",
		appFile: "app/src/lib/api/deposit-status.ts",
		constName: "DEPOSIT_STATUS",
	},
	{
		name: "refund status",
		serverFile: "server/src/lib/refund-status.ts",
		appFile: "app/src/lib/api/refund-status.ts",
		constName: "REFUND_STATUS",
	},
	{
		name: "model metadata verification",
		serverFile: "server/src/inference/model-metadata.ts",
		appFile: "app/src/lib/api/model-metadata.ts",
		constName: "MODEL_METADATA_VERIFICATION",
	},
	{
		name: "model unavailability cause",
		serverFile: "server/src/inference/model-unavailability-cause.ts",
		appFile: "app/src/lib/model-availability.ts",
		constName: "MODEL_UNAVAILABILITY_CAUSE",
	},
	{
		name: "model privacy",
		serverFile: "server/src/inference/model-metadata.ts",
		appFile: "app/src/lib/api/model-metadata.ts",
		constName: "MODEL_PRIVACY",
	},
];

/**
 * Extracts the `Key: "value"` pairs of a `export const NAME = { ... } as const`
 * block. Values are the state vocabulary; keys are developer-facing names.
 */
export function extractConstMap(source, constName) {
	const start = source.indexOf(`export const ${constName} = {`);
	if (start === -1) throw new Error(`const ${constName} not found`);
	const open = source.indexOf("{", start);
	let depth = 0;
	let end = open;
	for (let i = open; i < source.length; i++) {
		const ch = source[i];
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}
	const body = source.slice(open, end);
	const entries = [];
	const re = /([A-Za-z_$][\w$]*)\s*:\s*"([^"]+)"/g;
	let m;
	while ((m = re.exec(body)) !== null) entries.push([m[1], m[2]]);
	return entries;
}

/** Every distinct value in a const map. */
export function valuesOf(entries) {
	return [...new Set(entries.map(([, value]) => value))].sort();
}

/** The set difference `a - b`. */
export function missingFrom(a, b) {
	return a.filter((value) => !b.includes(value));
}

/**
 * Checks one vocabulary pair.
 *
 * Three kinds of drift are caught: a value one side does not know, a
 * developer-facing key that was renamed on one side only, and a status the
 * client has no label/tone for (which would render as "Unknown").
 */
export function checkContract(contract) {
	const serverSource = readFileSync(join(ROOT, contract.serverFile), "utf8");
	const appSource = readFileSync(join(ROOT, contract.appFile), "utf8");

	const serverEntries = extractConstMap(serverSource, contract.constName);
	const appEntries = extractConstMap(appSource, contract.constName);

	const serverValues = valuesOf(serverEntries);
	const appValues = valuesOf(appEntries);
	const problems = [];

	const missingOnApp = missingFrom(serverValues, appValues);
	const missingOnServer = missingFrom(appValues, serverValues);
	if (missingOnApp.length) problems.push(`client is missing status(es): ${missingOnApp.join(", ")}`);
	if (missingOnServer.length) problems.push(`server is missing status(es): ${missingOnServer.join(", ")}`);

	// The developer-facing key must match too, not just the wire value: the
	// key is what a caller writes (`USAGE_STATUS.FreeTier`), and a rename on
	// one side only would be a silent divergence.
	for (const [key, value] of serverEntries) {
		const onApp = appEntries.find(([appKey]) => appKey === key);
		if (!onApp) {
			problems.push(`client is missing status key "${key}"`);
			continue;
		}
		if (onApp[1] !== value) {
			problems.push(`status "${key}" is "${value}" on the server but "${onApp[1]}" on the client`);
		}
	}

	// Every status must be handled on the client, otherwise the UI falls
	// back to "Unknown" for a state the server can produce.
	for (const [key, value] of serverEntries) {
		const handled =
			appSource.includes(`${contract.constName}.${key}`) ||
			appSource.includes(`"${value}"`);
		if (!handled) problems.push(`client has no label for status "${value}"`);
	}

	return { problems, serverValues, appValues };
}

export function checkStateContract() {
	const problems = [];
	const contracts = [];
	for (const contract of STATE_CONTRACTS) {
		const result = checkContract(contract);
		contracts.push({ name: contract.name, ...result });
		for (const problem of result.problems) {
			problems.push(`[${contract.name}] ${problem}`);
		}
	}

	const usage = contracts.find((c) => c.name === "usage status");
	return {
		problems,
		serverValues: usage?.serverValues ?? [],
		appValues: usage?.appValues ?? [],
		contracts,
	};
}

function main() {
	const { problems, contracts } = checkStateContract();
	if (problems.length) {
		console.error("State contract FAILED:");
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	const summary = contracts
		.map((c) => `${c.name} (${c.serverValues.length})`)
		.join(", ");
	console.log(`State contract OK: ${summary} agree across client and server.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	main();
}
