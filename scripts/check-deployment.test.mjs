import test from "node:test";
import assert from "node:assert/strict";
import { checkDeployment } from "./check-deployment.mjs";

const ready = { status: "ready", service: "oma-ai", checks: { database: { ok: true }, redis: { ok: true } } };
const json = (body, status = 200) => Response.json(body, { status });
const run = (responses, url = "https://preview.example.test", options = {}) => {
  const calls = [];
  const fetchImpl = async (target, init) => { calls.push([target, init]); return responses.shift(); };
  return { result: checkDeployment(url, { fetchImpl, ...options }), calls };
};

test("checks real readiness and a signed-out session without credentials", async () => {
  const { result, calls } = run([json(ready), json(null)]);
  await result;
  assert.deepEqual(calls.map(([url]) => url), ["https://preview.example.test/api/ready", "https://preview.example.test/api/auth/get-session"]);
  for (const [, init] of calls) {
    assert.equal(init.redirect, "manual");
    assert.equal(init.credentials, "omit");
    assert.equal(init.method, "GET");
    assert.equal(new Headers(init.headers).has("authorization"), false);
    assert.equal(new Headers(init.headers).has("cookie"), false);
  }
});

test("rejects URLs that can disclose credentials or target the wrong path", async () => {
  for (const target of ["https://u:p@example.com", "https://example.com/path", "https://example.com/path/..", "https://example.com/?token=x", "https://example.com/#x", "http://example.com", "https://example.com/?"]) {
    await assert.rejects(checkDeployment(target, { fetchImpl: () => { throw new Error("must not fetch"); } }), /target|url/i);
  }
});

test("reports a missing Neon function without exposing response contents", async () => {
  const { result } = run([new Response("function not found secret marker", { status: 404 })]);
  await assert.rejects(result, error => /function.*missing|function.*not found/i.test(error.message) && !error.message.includes("secret marker"));
});

test("distinguishes protection, redirects, invalid JSON and unhealthy dependencies", async () => {
  for (const [response, expected] of [
    [new Response("private", { status: 401 }), /protect|unauthor/i],
    [new Response(null, { status: 302, headers: { location: "https://elsewhere.test" } }), /redirect/i],
    [new Response("not json"), /json/i],
    [json({ ...ready, status: "not_ready", checks: { ...ready.checks, database: { ok: false } } }, 503), /dependenc|readiness/i],
    [json({ ...ready, checks: { ...ready.checks, redis: { ok: true, status: "not_configured" } } }), /redis/i],
  ]) {
    await assert.rejects(run([response]).result, expected);
  }
  await assert.rejects(run([json(ready), json({ user: "unexpected" })]).result, /session/i);
  await assert.rejects(run([json(ready, 201)]).result, /readiness/i);
  await assert.rejects(run([json(ready), json(null, 201)]).result, /session/i);
});

test("deadline includes a stalled response body and caps response size", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled = true; } });
  const { result, calls } = run([new Response(stream), json(null)], undefined, { timeoutMs: 30 });
  await assert.rejects(result, /timed?\s*out|deadline/i);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(cancelled, true);
  assert.equal(calls.length, 1);
  await assert.rejects(run([new Response("x".repeat(1024))], undefined, { maxBytes: 100 }).result, /large|size/i);
});

test("stream failures are sanitized", async () => {
  const stream = new ReadableStream({ pull(controller) { controller.error(new Error("secret marker")); } });
  await assert.rejects(run([new Response(stream)]).result, error => /response|stream/i.test(error.message) && !error.message.includes("secret marker"));
});

test("protection and redirects cancel unread response bodies", async () => {
  for (const status of [401, 302]) {
    let cancelled = false;
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    await assert.rejects(run([new Response(stream, { status })]).result);
    assert.equal(cancelled, true);
  }
});
