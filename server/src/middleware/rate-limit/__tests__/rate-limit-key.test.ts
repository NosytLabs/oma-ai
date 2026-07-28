import { describe, it, expect } from "vitest";
import { getRateLimitKey } from "../utils.js";

function makeCtx(opts: {
  userId?: string;
  apiKeyId?: string;
  ip?: string;
}) {
  return {
    get: (k: string) => {
      if (k === "userId") return opts.userId;
      if (k === "apiKey")
        return opts.apiKeyId ? { id: opts.apiKeyId } : undefined;
      return undefined;
    },
    req: {
      header: (name: string) => {
        if (name.toLowerCase() === "x-forwarded-for") return opts.ip ?? "203.0.113.9";
        if (name.toLowerCase() === "x-real-ip") return opts.ip ?? "203.0.113.9";
        return undefined;
      },
    },
  };
}

describe("getRateLimitKey", () => {
  it("keys real users by userId", () => {
    const key = getRateLimitKey(
      makeCtx({ userId: "user-real-1" }) as never,
      "tb",
    );
    expect(key).toBe("tb:user-real-1");
  });

  it("keys free guests by IP, not shared oma-ai-guest id", () => {
    const key = getRateLimitKey(
      makeCtx({ userId: "oma-ai-guest", ip: "198.51.100.4" }) as never,
      "tb",
    );
    expect(key).toBe("tb:ip:198.51.100.4");
    expect(key).not.toContain("oma-ai-guest");
  });

  it("prefers api key id when present", () => {
    const key = getRateLimitKey(
      makeCtx({
        userId: "oma-ai-guest",
        apiKeyId: "key-1",
        ip: "198.51.100.4",
      }) as never,
      "tb",
    );
    expect(key).toBe("tb:key-1");
  });
});
