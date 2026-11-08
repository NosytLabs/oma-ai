#!/usr/bin/env node
/**
 * State contract guard.
 *
 * The client and the server describe the same usage lifecycle in two files
 * (one per package). Types cannot cross the package boundary, so nothing in
 * the compiler stops the two lists from drifting: the server adds a status,
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

const SERVER_FILE = join(ROOT, "server/src/lib/usage-status.ts");
const APP_FILE = join(ROOT, "app/src/lib/api/usage-status.ts");

export function checkStateContract() {
	const serverSource = readFileSync(SERVER_FILE, "utf8");
	const appSource = readFileSync(APP_FILE, "utf8");

	const serverEntries = extractConstMap(serverSource, "USAGE_STATUS");
	const appEntries = extractConstMap(appSource, "USAGE_STATUS");

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

	// Every status must have a human-readable label on the client, otherwise
	// the UI falls back to "Unknown" for a state the server can produce.
	const labelSwitch = appSource.slice(appSource.indexOf("export function usageStatusLabel"));
	for (const [key, value] of serverEntries) {
		if (!labelSwitch.includes(`USAGE_STATUS.${key}`) && !labelSwitch.includes(`"${value}"`)) {
			problems.push(`client has no label for status "${value}"`);
		}
	}

	return { problems, serverValues, appValues };
}

function main() {
	const { problems, serverValues } = checkStateContract();
	if (problems.length) {
		console.error("State contract FAILED:");
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`State contract OK: ${serverValues.length} usage status(es) agree across client and server.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	main();
}
