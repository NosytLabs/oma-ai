#!/usr/bin/env node
/**
 * Auto-generate OMA-AI changelog entries from git log.
 *
 * Reads conventional-commit style messages from the last N OMA-AI commits,
 * categorizes by feat/fix/perf/chore/refactor, and writes a JSON file the
 * changelog page imports alongside the hand-curated RELEASES array.
 *
 * Usage:  node scripts/generate-changelog.mjs
 *   or:  bun run scripts/generate-changelog.mjs
 *
 * Output: src/data/auto-changelog.json (gitignored — regenerable artifact)
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");
const OUTPUT = join(APP_ROOT, "src/data/auto-changelog.json");
const MAX_COMMITS = 50;

// OMA-AI is its own git repo (with the parent Desktop/Code/ as a separate
// monorepo for workspace-level state). We read git log from this sub-repo.
const REPO_ROOT = APP_ROOT;

const KIND_RULES = [
	{ kind: "feature", prefix: "feat" },
	{ kind: "fix", prefix: "fix" },
	{ kind: "perf", prefix: "perf" },
	{ kind: "perf", prefix: "refactor" },
	{ kind: "deprecation", prefix: "chore" },
];

function classify(message) {
	const lower = message.toLowerCase();
	for (const rule of KIND_RULES) {
		if (lower.startsWith(rule.prefix + ":") || lower.startsWith(rule.prefix + "(")) {
			return rule.kind;
		}
	}
	return "fix"; // default
}

function cleanMessage(message) {
	return message
		.replace(/^(feat|fix|perf|refactor|chore|docs|build|ci)(\([^)]+\))?:\s*/i, "")
		.replace(/\s+\(20\d{2}-\d{2}-\d{2}\)\s*$/, "")
		.trim();
}

function shortDate(iso) {
	// iso is YYYY-MM-DD; return as-is
	return iso;
}

function main() {
	let raw = "";
	try {
		raw = execFileSync(
			"git",
			[
				"log",
				`--max-count=${MAX_COMMITS}`,
				"--pretty=format:%h%x1f%s%x1f%ad",
				"--date=short",
			],
			{ cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
		);
	} catch (err) {
		console.error("git log failed:", err.message);
		process.exit(1);
	}

	if (!raw.trim()) {
		console.log("no commits found; skipping");
		return;
	}

	const lines = raw.split("\n").filter(Boolean);
	const commits = lines.map((line) => {
		const [sha, subject, date] = line.split("\x1f");
		return { sha, subject, date };
	});

	// Group by date — each day becomes a release
	const byDate = new Map();
	for (const c of commits) {
		const arr = byDate.get(c.date) ?? [];
		arr.push(c);
		byDate.set(c.date, arr);
	}

	const releases = [];
	for (const [date, dayCommits] of [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
		const changes = dayCommits.map((c) => ({
			kind: classify(c.subject),
			text: cleanMessage(c.subject),
			sha: c.sha,
		}));
		// Codename: first commit, cleaned and truncated
		const firstSubject = cleanMessage(dayCommits[0].subject);
		const codename = firstSubject.length > 40 ? firstSubject.slice(0, 37) + "…" : firstSubject;
		releases.push({
			version: `auto.${date}`,
			date,
			codename,
			summary: `${dayCommits.length} commit${dayCommits.length === 1 ? "" : "s"} on ${date}`,
			changes,
			auto: true,
		});
	}

	mkdirSync(dirname(OUTPUT), { recursive: true });
	writeFileSync(OUTPUT, JSON.stringify(releases, null, "\t") + "\n");
	console.log(`✓ wrote ${releases.length} auto-generated release(s) to ${OUTPUT}`);
}

main();
