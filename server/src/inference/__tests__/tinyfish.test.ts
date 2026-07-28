/**
 * TinyFish + Wikipedia fallback tests.
 * Uses vitest (server test runner); mocks config via vi.mock + vi.stubEnv.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const configState = { TINYFISH_API_KEY: undefined as string | undefined };

vi.mock("../../config.js", () => ({
  config: new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "TINYFISH_API_KEY") return configState.TINYFISH_API_KEY;
        return undefined;
      },
    },
  ),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

import {
  searchWeb,
  searchDuckDuckGoFallback,
  normalizeSearchQuery,
} from "../tinyfish.js";

describe("searchWeb", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    configState.TINYFISH_API_KEY = undefined;
    globalThis.fetch = originalFetch;
  });

  it("uses Wikipedia keyless fallback when TinyFish is not configured", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            "OpenAI API",
            ["OpenAI", "API"],
            ["AI company", "Application programming interface"],
            [
              "https://en.wikipedia.org/wiki/OpenAI",
              "https://en.wikipedia.org/wiki/API",
            ],
          ]),
          { status: 200 },
        ),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const out = await searchWeb("OpenAI API");
    expect(out.provider).toBe("duckduckgo");
    expect(out.results.length).toBe(2);
    expect(out.results[0].url).toContain("wikipedia.org");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("wikipedia.org");
  });

  it("calls TinyFish when API key is set", async () => {
    configState.TINYFISH_API_KEY = "tf-test-key";
    const payload = {
      query: "hello",
      results: [
        {
          position: 1,
          site_name: "example",
          title: "Hello",
          snippet: "world",
          url: "https://example.com",
        },
      ],
      total_results: 1,
      page: 1,
    };
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const out = await searchWeb("hello");
    expect(out.provider).toBe("tinyfish");
    expect(out.results[0].title).toBe("Hello");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["X-API-Key"]).toBe("tf-test-key");
  });

  it("falls back to Wikipedia when TinyFish returns an error", async () => {
    configState.TINYFISH_API_KEY = "tf-test-key";
    let n = 0;
    globalThis.fetch = (async () => {
      n += 1;
      if (n === 1) {
        return new Response("rate limited", { status: 429 });
      }
      return new Response(
        JSON.stringify([
          "q",
          ["Fallback"],
          ["fallback hit"],
          ["https://en.wikipedia.org/wiki/Fallback"],
        ]),
        { status: 200 },
      );
    }) as typeof fetch;

    const out = await searchWeb("q");
    expect(out.provider).toBe("duckduckgo");
    expect(out.results[0].snippet).toContain("fallback");
  });

  it("normalizeSearchQuery strips chat fluff for Wikipedia", () => {
    expect(
      normalizeSearchQuery("What is the capital of France? One short sentence."),
    ).toMatch(/capital of France/i);
    expect(normalizeSearchQuery("What is OMA AI? One short sentence.")).toMatch(
      /OMA AI/i,
    );
  });

  it("searchDuckDuckGoFallback maps opensearch rows", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          "topics",
          ["One", "Two"],
          ["first", "second"],
          ["https://a.example/1", "https://b.example/2"],
        ]),
        { status: 200 },
      )) as typeof fetch;
    const out = await searchDuckDuckGoFallback("topics");
    expect(out.results.length).toBe(2);
    expect(out.results[0].title).toBe("One");
  });
});
