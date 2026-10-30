import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { stopAuthTestProcess } from "./auth-test-process.mjs";

async function forceCleanup(child) {
	if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
	const exited = once(child, "exit", { signal: AbortSignal.timeout(1000) });
	child.kill("SIGKILL");
	await exited;
}
async function startChild(t, source = "setInterval(() => {}, 1000)", expectReady = false) {
	const child = spawn(process.execPath, ["-e", source], { stdio: ["ignore", "pipe", "ignore"], env: {} });
	// Register cleanup before waiting for either process startup or readiness.
	t.after(() => forceCleanup(child));
	const ready = expectReady ? once(child.stdout, "data", { signal: AbortSignal.any([t.signal, AbortSignal.timeout(1000)]) }) : null;
	await once(child, "spawn", { signal: t.signal });
	if (ready) await ready;
	return child;
}
async function withinDeadline(operation, signal, timeoutMs = 1000) {
	const controller = new AbortController();
	try {
		return await Promise.race([
			operation.then(() => "stopped"),
			delay(timeoutMs, "deadline", { signal: AbortSignal.any([signal, controller.signal]) }),
		]);
	} finally { controller.abort(); }
}

test("stops a running auth-test child normally", { timeout: 5000 }, async t => {
	const child = await startChild(t);
	assert.equal(await withinDeadline(stopAuthTestProcess(child, { graceMs: 50 }), t.signal), "stopped");
	assert.equal(child.signalCode, "SIGTERM");
});

test("does not wait for a past exit when the auth-test child was already signaled", { timeout: 5000 }, async t => {
	const child = await startChild(t);
	const exited = once(child, "exit", { signal: t.signal });
	child.kill("SIGTERM");
	await exited;
	assert.equal(child.exitCode, null);
	assert.equal(child.signalCode, "SIGTERM");
	assert.equal(await withinDeadline(stopAuthTestProcess(child, { graceMs: 50 }), t.signal), "stopped");
});

test("bounds shutdown when the auth-test child ignores SIGTERM", { timeout: 5000 }, async t => {
	const child = await startChild(t, "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)", true);
	assert.equal(await withinDeadline(stopAuthTestProcess(child, { graceMs: 50 }), t.signal), "stopped");
	assert.equal(child.signalCode, "SIGKILL");
});
