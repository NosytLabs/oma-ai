import { once } from "node:events";

const hasExited = child => child.exitCode !== null || child.signalCode !== null;

/** Stop only the ChildProcess created by the local auth integration harness. */
export async function stopAuthTestProcess(child, { graceMs = 5000 } = {}) {
	if (!child?.pid || hasExited(child)) return;
	const deadline = new AbortController();
	// Register before sending a signal; a fast child may exit immediately.
	const stopped = once(child, "exit", { signal: deadline.signal });
	const forceTimer = setTimeout(() => {
		// Use the child handle, never a saved numeric PID that might be reused.
		if (hasExited(child)) return;
		try { child.kill("SIGKILL"); }
		catch (error) { deadline.abort(error); }
	}, graceMs);
	const deadlineTimer = setTimeout(() => deadline.abort(new Error("Auth test child did not exit after forced shutdown")), graceMs + 1000);
	try {
		try { child.kill("SIGTERM"); }
		catch (error) { deadline.abort(error); }
		await stopped;
	} finally {
		clearTimeout(forceTimer);
		clearTimeout(deadlineTimer);
		// Also remove once() listeners if startup/signaling failed.
		deadline.abort();
	}
}
