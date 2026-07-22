import { describe, it, expect, vi, afterEach } from "vitest";
import {
  readBodyLimited,
  DEFAULT_MAX_RESPONSE_BYTES,
  fetchWebPages,
} from "../tinyfish-fetch.js";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/** Async-iterable body that yields many chunks (simulates a large stream). */
async function* chunkedBody(parts: string[]): AsyncGenerator<Buffer> {
  for (const p of parts) {
    yield Buffer.from(p);
  }
}

describe("readBodyLimited (shipped body cap for /v1/fetch)", () => {
  it("returns empty string when maxBytes <= 0", async () => {
    expect(await readBodyLimited(chunkedBody(["hello"]), 0)).toBe("");
    expect(await readBodyLimited(chunkedBody(["hello"]), -1)).toBe("");
  });

  it("returns full content when under the cap", async () => {
    const text = await readBodyLimited(chunkedBody(["hello ", "world"]), 100);
    expect(text).toBe("hello world");
  });

  it("truncates mid-chunk once the byte cap is reached", async () => {
    const text = await readBodyLimited(
      chunkedBody(["aaaa", "bbbb", "cccc"]),
      6,
    );
    // 4 from first chunk + 2 from second; third never consumed into result
    expect(text).toBe("aaaabb");
    expect(Buffer.byteLength(text, "utf8")).toBe(6);
  });

  it("never buffers more than maxBytes even when stream is multi-MB", async () => {
    const chunk = "x".repeat(64 * 1024); // 64 KiB per chunk
    async function* huge(): AsyncGenerator<Buffer> {
      // 50 × 64 KiB = ~3.2 MiB stream — would OOM-risk if fully buffered
      for (let i = 0; i < 50; i++) {
        yield Buffer.from(chunk);
      }
    }

    const max = DEFAULT_MAX_RESPONSE_BYTES; // 50_000
    const text = await readBodyLimited(huge(), max);
    expect(Buffer.byteLength(text, "utf8")).toBe(max);
    expect(text.length).toBe(max); // ascii
  });

  it("calls body.dump() after truncating so remaining data is drained", async () => {
    const dump = vi.fn(async () => undefined);
    const body = Object.assign(chunkedBody(["0123456789", "ABCDEFGHIJ"]), {
      dump,
    });
    const text = await readBodyLimited(body, 5);
    expect(text).toBe("01234");
    expect(dump).toHaveBeenCalledTimes(1);
  });

  it("does not call dump when the whole body fits under the cap", async () => {
    const dump = vi.fn(async () => undefined);
    const body = Object.assign(chunkedBody(["hi"]), { dump });
    await readBodyLimited(body, 100);
    expect(dump).not.toHaveBeenCalled();
  });
});

describe("fetchWebPages pinned path enforces maxResponseBytes end-to-end", () => {
  let server: Server;
  let baseUrl: string;
  let pinnedIp: string;

  async function listen(
    handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
  ): Promise<void> {
    server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as AddressInfo;
    pinnedIp = "127.0.0.1";
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it("caps response content at maxResponseBytes on the real HTTP path", async () => {
    // ~200 KB of payload — well over the 50 KB default cap
    const payload = "Z".repeat(200_000);
    await listen((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Content-Length": String(payload.length),
      });
      res.end(payload);
    });

    const host = new URL(baseUrl).hostname;
    const { results } = await fetchWebPages(
      [`${baseUrl}/big`],
      { [host]: pinnedIp },
      { maxResponseBytes: 50_000 },
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe(200);
    expect(Buffer.byteLength(results[0].content, "utf8")).toBe(50_000);
    expect(results[0].content).toBe("Z".repeat(50_000));
  });

  it("honors a custom smaller maxResponseBytes", async () => {
    await listen((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("abcdefghij");
    });

    const host = new URL(baseUrl).hostname;
    const { results } = await fetchWebPages(
      [`${baseUrl}/small`],
      { [host]: pinnedIp },
      { maxResponseBytes: 4 },
    );

    expect(results[0].content).toBe("abcd");
    expect(results[0].status).toBe(200);
  });
});
