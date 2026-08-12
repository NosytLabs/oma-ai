#!/usr/bin/env node
/**
 * Regenerate flat brand PNGs from SVG masters (requires `rsvg-convert`).
 * Usage: npm run brand:generate  (from app/)
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

function rsvg(args) {
	execFileSync("rsvg-convert", args, { stdio: "inherit" });
}

function requireCmd() {
	try {
		execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
	} catch {
		console.error("rsvg-convert not found — install librsvg (brew install librsvg)");
		process.exit(1);
	}
}

requireCmd();

const favicon = join(pub, "favicon.svg");
const icon = join(pub, "logos", "oma-icon.svg");
if (!existsSync(favicon) || !existsSync(icon)) {
	console.error("Missing favicon.svg or logos/oma-icon.svg");
	process.exit(1);
}

rsvg(["-w", "16", "-h", "16", favicon, "-o", join(pub, "favicon-16x16.png")]);
rsvg(["-w", "32", "-h", "32", favicon, "-o", join(pub, "favicon-32x32.png")]);
// Single-res .ico fallback (browsers prefer svg/png)
rsvg(["-w", "32", "-h", "32", favicon, "-o", join(pub, "favicon.ico")]);
rsvg(["-w", "180", "-h", "180", icon, "-o", join(pub, "apple-touch-icon.png")]);
rsvg(["-w", "192", "-h", "192", icon, "-o", join(pub, "logos", "oma-icon-192.png")]);
rsvg(["-w", "512", "-h", "512", icon, "-o", join(pub, "logos", "oma-icon-512.png")]);
rsvg(["-w", "1024", "-h", "1024", icon, "-o", join(pub, "logos", "oma-icon-1024.png")]);

console.log("Brand PNGs regenerated from SVG masters.");
