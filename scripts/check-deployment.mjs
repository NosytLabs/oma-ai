#!/usr/bin/env node
import { pathToFileURL } from "node:url";

function targetOrigin(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Target must be an absolute URL."); }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (typeof raw !== "string" || !/^https?:\/\/[^/?#]+\/?$/i.test(raw) || url.username || url.password || url.pathname !== "/" ||
      !(url.protocol === "https:" || (url.protocol === "http:" && loopback))) {
    throw new Error("Target URL must be an HTTPS origin without credentials, path, query or fragment (HTTP is allowed for loopback only).");
  }
  return url.origin;
}

async function readBounded(response, maxBytes, signal) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error("Deployment check timed out; check the target and its API.");
      let result;
      try { result = await reader.read(); } catch {
        cancel();
        throw new Error("Deployment response stream failed; check the API target and network.");
      }
      if (signal.aborted) throw new Error("Deployment check timed out; check the target and its API.");
      const { done, value } = result;
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        cancel();
        throw new Error("Deployment response exceeded the size limit.");
      }
      chunks.push(value);
    }
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function checkDeployment(rawTarget, { fetchImpl = fetch, timeoutMs = 10_000, maxBytes = 65_536 } = {}) {
  const origin = targetOrigin(rawTarget);
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { reject(new Error("Deployment check timed out; check the target and its API.")); controller.abort(); }, timeoutMs);
  });
  const probe = async (path) => {
    if (controller.signal.aborted) throw new Error("Deployment check timed out; check the target and its API.");
    let response;
    try {
      response = await fetchImpl(`${origin}${path}`, {
        method: "GET", credentials: "omit", redirect: "manual", headers: { accept: "application/json" }, signal: controller.signal,
      });
    } catch { throw new Error("Deployment request failed; check the target and network access."); }
    if (controller.signal.aborted) {
      void response.body?.cancel().catch(() => {});
      throw new Error("Deployment check timed out; check the target and its API.");
    }
    if (response.status === 401 || response.status === 403) {
      void response.body?.cancel().catch(() => {});
      throw new Error("Deployment is unauthorized or protected; check preview access.");
    }
    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => {});
      throw new Error("Deployment returned a redirect; check the target and preview protection.");
    }
    const body = await readBounded(response, maxBytes, controller.signal);
    if (/function\s+not\s+found/i.test(body)) throw new Error("API function not found; check the configured Neon function and branch.");
    let value;
    try { value = JSON.parse(body); } catch { throw new Error("Deployment returned malformed JSON; check the API target and preview protection."); }
    if (response.status !== 200) throw new Error(path === "/api/ready" ? "API readiness or a dependency failed; inspect database and Redis." : "Session endpoint failed; check the API target and auth service.");
    return value;
  };
  try {
    await Promise.race([(async () => {
      const readiness = await probe("/api/ready");
      if (readiness?.status !== "ready" || readiness?.service !== "oma-ai" ||
          readiness?.checks?.database?.ok !== true || readiness?.checks?.database?.status !== "ok" ||
          readiness?.checks?.redis?.ok !== true || readiness?.checks?.redis?.status !== "ok") {
        throw new Error("API readiness or a dependency failed; inspect database and Redis.");
      }
      const session = await probe("/api/auth/get-session");
      if (session !== null) throw new Error("Signed-out session response was unexpected; check the auth service.");
    })(), deadline]);
  } finally { clearTimeout(timer); controller.abort(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    console.error("Usage: pnpm check:deployment <https-origin>");
    process.exitCode = 1;
  } else {
    try {
      await checkDeployment(process.argv[2]);
      console.log("Deployment ready: API dependencies and signed-out session passed.");
    } catch (error) {
      console.error(`Deployment check failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
