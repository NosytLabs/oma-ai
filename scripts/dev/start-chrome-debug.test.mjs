import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./start-chrome-debug.sh", import.meta.url));

test("an occupied debugging port fails without terminating its listener", () => {
  const dir = mkdtempSync(join(tmpdir(), "oma-chrome-test-"));
  try {
    for (const [name, body] of Object.entries({
      "google-chrome": "exit 0",
      lsof: "echo 12345",
      xargs: `touch '${dir}/kill-attempt'`,
      sleep: "exit 0",
      curl: "echo '{\"webSocketDebuggerUrl\":\"test\"}'",
    })) writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    const result = spawnSync("bash", [script, "9222"], { encoding: "utf8", env: { ...process.env, OMA_CHROME_BIN: join(dir, "google-chrome"), PATH: `${dir}:${process.env.PATH}`, TMPDIR: dir } });
    assert.notEqual(result.status, 0, "helper must report that the port is occupied");
    assert.match(result.stderr, /port.*(?:in use|occupied)/i);
    assert.equal(existsSync(join(dir, "kill-attempt")), false, "the helper must not kill the existing listener");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a different port uses its own profile without removing browser locks", () => {
  const dir = mkdtempSync(join(tmpdir(), "oma-chrome-test-"));
  try {
    for (const profile of ["chrome-bh", "chrome-bh-9222", "chrome-bh-9333"]) {
      mkdirSync(join(dir, profile));
      for (const lock of ["SingletonLock", "SingletonSocket"]) writeFileSync(join(dir, profile, lock), "preserve");
    }
    for (const [name, body] of Object.entries({
      "google-chrome": `printf '%s\\n' "$@" > '${dir}/chrome-args'`,
      lsof: "exit 1",
      curl: `while [ ! -f '${dir}/chrome-args' ]; do /bin/sleep 0.01; done\necho '{"webSocketDebuggerUrl":"test"}'`,
    })) writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    const result = spawnSync("bash", [script, "9333"], { encoding: "utf8", timeout: 5000, env: { ...process.env, OMA_CHROME_BIN: join(dir, "google-chrome"), PATH: `${dir}:${process.env.PATH}`, TMPDIR: dir } });
    assert.equal(result.status, 0, result.stderr);
    for (const profile of ["chrome-bh", "chrome-bh-9222", "chrome-bh-9333"]) {
      for (const lock of ["SingletonLock", "SingletonSocket"]) {
        assert.equal(readFileSync(join(dir, profile, lock), "utf8"), "preserve");
      }
    }
    assert.ok(readFileSync(join(dir, "chrome-args"), "utf8").split("\n").includes(`--user-data-dir=${dir}/chrome-bh-9333`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a configured Chrome binary must be an absolute executable path", () => {
  const result = spawnSync("bash", [script], { encoding: "utf8", env: { ...process.env, OMA_CHROME_BIN: "relative-chrome" } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /OMA_CHROME_BIN.*absolute.*executable/i);
});
