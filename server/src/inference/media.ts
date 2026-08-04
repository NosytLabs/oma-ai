/**
 * Venice media client — image generation + async video generation.
 *
 * Restored from the pre-`d6289ec` venice.ts helper (which was deleted
 * along with the media routers) and re-based on the current stack:
 * config from config.ts, error mapping here, billing in routes/media.ts.
 */
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

const MEDIA_TIMEOUT_MS = 120_000;

class MediaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MediaError";
  }
}

function veniceUrl(path: string): string {
  return `${config.VENICE_API_URL}${path}`;
}

function veniceHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.VENICE_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

function checkVeniceConfig(): void {
  if (!config.VENICE_API_KEY) {
    throw new MediaError(
      "Inference provider not configured (VENICE_API_KEY missing).",
      503,
    );
  }
}

function mapVeniceError(status: number, text: string): never {
  // Preserve the upstream error message instead of masking it as a
  // generic 500 — users hit 402 (DIEM spend limit), 429, and 5xx.
  let message = text.slice(0, 500) || "Venice media request failed";
  try {
    const json = JSON.parse(text) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch {
    // not JSON — use raw text
  }
  throw new MediaError(message, status);
}

export async function imageGeneration(body: {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  [key: string]: unknown;
}): Promise<{ images: Array<{ url: string }> }> {
  checkVeniceConfig();
  const response = await fetch(veniceUrl("/api/v1/image/generate"), {
    method: "POST",
    headers: veniceHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.warn({ status: response.status, model: body.model }, "[media] image upstream error");
    mapVeniceError(response.status, text);
  }
  return response.json();
}

export async function videoQuote(body: {
  model: string;
  prompt: string;
  duration?: string;
  aspect_ratio?: string;
  resolution?: string;
  image_url?: string;
}): Promise<{ price: number; currency: string; estimated_seconds: number }> {
  checkVeniceConfig();
  const response = await fetch(veniceUrl("/api/v1/video/quote"), {
    method: "POST",
    headers: veniceHeaders(),
    body: JSON.stringify({
      model: body.model,
      prompt: body.prompt,
      duration: body.duration || "5s",
      aspect_ratio: body.aspect_ratio || "16:9",
      resolution: body.resolution || "720p",
      ...(body.image_url && { image_url: body.image_url }),
    }),
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    mapVeniceError(response.status, text);
  }
  const data = (await response.json()) as {
    price?: number;
    currency?: string;
    estimated_seconds?: number;
  };
  return {
    price: data.price ?? 0,
    currency: data.currency ?? "usd",
    estimated_seconds: data.estimated_seconds ?? 0,
  };
}

export async function videoGeneration(body: {
  model: string;
  prompt: string;
  duration?: string;
  aspect_ratio?: string;
  resolution?: string;
  image_url?: string;
}): Promise<{ queueId: string; status: string }> {
  checkVeniceConfig();
  const response = await fetch(veniceUrl("/api/v1/video/queue"), {
    method: "POST",
    headers: veniceHeaders(),
    body: JSON.stringify({
      model: body.model,
      prompt: body.prompt,
      duration: body.duration || "5s",
      aspect_ratio: body.aspect_ratio || "16:9",
      resolution: body.resolution || "720p",
      ...(body.image_url && { image_url: body.image_url }),
    }),
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    mapVeniceError(response.status, text);
  }
  const data = (await response.json()) as { queue_id?: string };
  return { queueId: data.queue_id ?? "", status: "queued" };
}

export async function retrieveVideo(
  queueId: string,
  model?: string,
): Promise<{ status: string; video_url?: string; download_url?: string }> {
  checkVeniceConfig();
  const response = await fetch(veniceUrl("/api/v1/video/retrieve"), {
    method: "POST",
    headers: veniceHeaders(),
    body: JSON.stringify({ queue_id: queueId, model }),
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    mapVeniceError(response.status, text);
  }
  return response.json();
}
