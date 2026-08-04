#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public/logos/oma-icon.svg");
const converter = process.env.RSVG_CONVERT ?? "rsvg-convert";

if (!existsSync(source)) {
	throw new Error(`Canonical icon not found: ${source}`);
}

for (const size of [192, 512, 1024]) {
	const output = resolve(root, `public/logos/oma-icon-${size}.png`);
	mkdirSync(dirname(output), { recursive: true });
	execFileSync(converter, ["-w", String(size), "-h", String(size), "-o", output, source], {
		stdio: "inherit",
	});
	console.log(`Generated ${output}`);
}
