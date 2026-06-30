import { describe, it, expect, vi } from "vitest";
import {
  videoGeneration,
  retrieveVideo,
  veniceModels,
} from "../venice.js";

const { config } = await import("../../config.js");

const mockConfig = vi.hoisted(() => ({
  VENICE_API_KEY: "test-venice-key",
  VENICE_API_URL: "https://api.venice.ai",
  NODE_ENV: "test",
  RECEIPT_HMAC_SECRET: "test-receipt-secret-at-least-32-chars!",
}));

vi.mock("../../config.js", () => ({
  config: mockConfig,
}));

vi.mock("../../inference/cheaptokens.js", () => ({
  getActiveVeniceKey: vi.fn().mockReturnValue("test-venice-key"),
}));

describe("veniceModels", () => {
  it("returns models list from API", async () => {
    const mockResponse = {
      data: [
        { id: "qwen3-4b", name: "Qwen3 4B" },
        { id: "llama-3.2-3b", name: "Llama 3.2 3B" },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
      headers: new Headers(),
    });

    const models = await veniceModels();
    expect(models).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/models"),
      expect.any(Object)
    );
  });

  it("throws error when API key not configured", async () => {
    vi.mocked(config).VENICE_API_KEY = "";

    await expect(veniceModels()).rejects.toThrow("Venice API key not configured");
  });
});

describe("videoGeneration", () => {
  it("submits video generation job", async () => {
    const mockResponse = { queue_id: "video-123", status: "queued" };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
      headers: new Headers(),
    });

    const result = await videoGeneration({
      model: "seedance-2-0-text-to-video",
      prompt: "A beautiful sunset",
      duration: "5s",
      aspect_ratio: "16:9",
      resolution: "720p",
    });

    expect(result.queueId).toBe("video-123");
    expect(result.status).toBe("queued");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/video/queue"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws error on video generation failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Video generation failed"),
      headers: new Headers(),
    });

    try {
      await videoGeneration({ model: "seedance-2-0-text-to-video", prompt: "test" });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean };
      expect(e.status).toBe(500);
      expect(e.code).toBe("venice_server_error");
      expect(e.retryable).toBe(true);
      expect(e.message).toContain("Video generation failed");
    }
  });
});

describe("retrieveVideo", () => {
  it("retrieves video status", async () => {
    const mockResponse = {
      status: "completed",
      video_url: "https://example.com/video.mp4",
      download_url: "https://example.com/download.mp4",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
      headers: new Headers(),
    });

    const result = await retrieveVideo("video-123");
    expect(result.status).toBe("completed");
    expect(result.video_url).toBe("https://example.com/video.mp4");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/video/retrieve"),
      expect.any(Object)
    );
  });

  it("throws error on video retrieval failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Retrieval failed"),
      headers: new Headers(),
    });

    try {
      await retrieveVideo("video-123");
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean };
      expect(e.status).toBe(500);
      expect(e.code).toBe("venice_server_error");
      expect(e.retryable).toBe(true);
      expect(e.message).toContain("Retrieval failed");
    }
  });
});