import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./start-dev.sh", import.meta.url));

function readinessFixture(commands) {
  const dir = mkdtempSync(join(tmpdir(), "oma-dev-ready-"));
  for (const subdir of ["scripts/dev", "server", "app", "bin"]) mkdirSync(join(dir, subdir), { recursive: true });
  copyFileSync(script, join(dir, "scripts/dev/start-dev.sh"));
  writeFileSync(join(dir, "server/.env"), "DATABASE_URL=local\n");
  for (const [name, body] of Object.entries(commands)) writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  const result = spawnSync("bash", [join(dir, "scripts/dev/start-dev.sh")], { encoding: "utf8", timeout: 5000, env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, OMA_TEST_DIR: dir } });
  return { dir, result };
}

test("a service exiting during startup fails without reporting success", () => {
  const { dir, result } = readinessFixture({ curl: "exit 1", lsof: "exit 1", npm: "exit 42", sleep: "/bin/sleep 0.03" });
  try {
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /OMA AI Gateway is running/);
    assert.match(result.stderr, /API.*exited/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an unready listener times out without reporting success", () => {
  const { dir, result } = readinessFixture({ curl: "exit 1", lsof: "exit 1", npm: "exec /bin/sleep 4", sleep: "exit 0" });
  try {
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /OMA AI Gateway is running/);
    assert.match(result.stderr, /API.*(?:timed out|not ready)/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a frontend exit is detected while waiting for the API", () => {
  const { dir, result } = readinessFixture({
    curl: "exit 1", lsof: "exit 1", npm: 'if [ "$(basename "$PWD")" = app ]; then exit 42; fi\nexec /bin/sleep 4', sleep: "/bin/sleep 0.03",
  });
  try {
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /OMA AI Gateway is running/);
    assert.match(result.stderr, /Frontend.*exited/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("reports success after newly started services respond", () => {
  const { dir, result } = readinessFixture({
    curl: 'case "$*" in *3001*) test -f "$OMA_TEST_DIR/server-ready";; *3000*) test -f "$OMA_TEST_DIR/app-ready";; esac',
    lsof: "exit 1", npm: 'touch "$OMA_TEST_DIR/$(basename "$PWD")-ready"\nexec /bin/sleep 0.3', sleep: "/bin/sleep 0.03",
  });
  try {
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OMA AI Gateway is running/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("reports success when both existing services respond", () => {
  const { dir, result } = readinessFixture({ curl: "exit 0", lsof: "exit 1", npm: "exit 42", sleep: "exit 0" });
  try {
    assert.equal(result.status, 0);
    assert.match(result.stdout, /API server already healthy/);
    assert.match(result.stdout, /Frontend already responding/);
    assert.match(result.stdout, /OMA AI Gateway is running/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a blocked frontend port does not leave a newly started API behind", async () => {
  const dir = mkdtempSync(join(tmpdir(), "oma-dev-test-"));
  let pid;
  try {
    for (const subdir of ["scripts/dev", "server", "app", "bin"]) mkdirSync(join(dir, subdir), { recursive: true });
    copyFileSync(script, join(dir, "scripts/dev/start-dev.sh"));
    writeFileSync(join(dir, "server/.env"), "DATABASE_URL=local\n");
    const commands = {
      curl: "exit 1",
      lsof: 'case "$*" in *3000*) exit 0;; *) exit 1;; esac',
      npm: `echo $$ > '${dir}/api.pid'\nexec /bin/sleep 2 >/dev/null 2>&1`,
      sleep: `for i in $(seq 1 100); do [ -f '${dir}/api.pid' ] && exit 0; /bin/sleep 0.01; done\nexit 1`,
    };
    for (const [name, body] of Object.entries(commands)) writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    const result = spawnSync("bash", [join(dir, "scripts/dev/start-dev.sh")], { encoding: "utf8", timeout: 5000, env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}` } });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Port 3000 is occupied/);
    assert.equal(existsSync(join(dir, "api.pid")), true);
    pid = Number(readFileSync(join(dir, "api.pid"), "utf8"));
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, "the API process must stop when launcher startup fails");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed launch signals the owned API's descendant", async () => {
  const dir = mkdtempSync(join(tmpdir(), "oma-dev-test-"));
  try {
    for (const subdir of ["scripts/dev", "server", "app", "bin"]) mkdirSync(join(dir, subdir), { recursive: true });
    copyFileSync(script, join(dir, "scripts/dev/start-dev.sh"));
    writeFileSync(join(dir, "server/.env"), "DATABASE_URL=local\n");
    for (const [name, body] of Object.entries({
      curl: "exit 1",
      lsof: 'case "$*" in *3000*) exit 0;; *) exit 1;; esac',
      npm: `sh '${dir}/bin/descendant' >/dev/null 2>&1 &\nwait`,
      descendant: `trap 'touch "${dir}/terminated"; exit 0' TERM\ntouch '${dir}/started'\nfor i in $(seq 1 250); do [ -f '${dir}/stop' ] && exit 0; /bin/sleep 0.02; done`,
      sleep: `for i in $(seq 1 100); do [ -f '${dir}/started' ] && exit 0; /bin/sleep 0.01; done\nexit 1`,
    })) writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    const result = spawnSync("bash", [join(dir, "scripts/dev/start-dev.sh")], { encoding: "utf8", timeout: 5000, env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}` } });
    assert.equal(result.status, 1);
    for (let i = 0; i < 50 && !existsSync(join(dir, "terminated")); i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(existsSync(join(dir, "terminated")), true, "the API descendant must receive termination");
  } finally {
    writeFileSync(join(dir, "stop"), "stop");
    await new Promise(resolve => setTimeout(resolve, 50));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a reused API is not stopped when frontend startup fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "oma-dev-test-"));
  const existing = spawn("/bin/sleep", ["30"], { stdio: "ignore" });
  try {
    for (const subdir of ["scripts/dev", "server", "app", "bin"]) mkdirSync(join(dir, subdir), { recursive: true });
    copyFileSync(script, join(dir, "scripts/dev/start-dev.sh"));
    writeFileSync(join(dir, "server/.env"), "DATABASE_URL=local\n");
    for (const [name, body] of Object.entries({
      curl: 'case "$*" in *3001*) exit 0;; *) exit 1;; esac',
      lsof: 'case "$*" in *3000*) exit 0;; *) exit 1;; esac',
      npm: `touch '${dir}/unexpected-start'`,
      sleep: "exit 0",
    })) writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    const result = spawnSync("bash", [join(dir, "scripts/dev/start-dev.sh")], { encoding: "utf8", timeout: 5000, env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}` } });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /API server already healthy/);
    assert.match(result.stdout, /Port 3000 is occupied/);
    assert.equal(existsSync(join(dir, "unexpected-start")), false);
    assert.doesNotThrow(() => process.kill(existing.pid, 0));
  } finally {
    existing.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cleanup force-stops a descendant that ignores TERM within a bounded time", async () => {
  const dir = mkdtempSync(join(tmpdir(), "oma-dev-test-"));
  try {
    for (const subdir of ["scripts/dev", "server", "app", "bin"]) mkdirSync(join(dir, subdir), { recursive: true });
    copyFileSync(script, join(dir, "scripts/dev/start-dev.sh"));
    writeFileSync(join(dir, "server/.env"), "DATABASE_URL=local\n");
    for (const [name, body] of Object.entries({
      curl: "exit 1",
      lsof: 'case "$*" in *3000*) exit 0;; *) exit 1;; esac',
      npm: `trap '' TERM\n/bin/sleep 5 >/dev/null 2>&1 &\necho $! > '${dir}/descendant.pid'\ntouch '${dir}/started'\nwait`,
      sleep: `for i in $(seq 1 100); do [ -f '${dir}/started' ] && exit 0; /bin/sleep 0.01; done\nexit 1`,
    })) writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    const result = spawnSync("bash", [join(dir, "scripts/dev/start-dev.sh")], { encoding: "utf8", timeout: 4000, env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}` } });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Port 3000 is occupied/);
    const descendantPid = readFileSync(join(dir, "descendant.pid"), "utf8").trim();
    let state = "";
    for (let i = 0; i < 50; i++) {
      state = spawnSync("ps", ["-o", "stat=", "-p", descendantPid], { encoding: "utf8" }).stdout.trim();
      if (!state || state.startsWith("Z")) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(!state || state.startsWith("Z"), "the TERM-ignoring descendant must no longer be running");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
