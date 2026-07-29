// PixelRAG self-hosted visual search — screenshot-native RAG over any corpus.
//
// POST /v1/pixel-search  → proxies to local pixelrag serve (text/image queries)
// POST /v1/pixel-shot    → runs pixelshot locally to render new pages/PDFs
// POST /v1/pixel-index   → enqueues a pixelrag index build over a corpus
// GET  /v1/pixel-search/health  → checks local pixelrag serve
// GET  /v1/pixel-search/status  → index stats (vectors, dimension, model)
// GET  /v1/pixel-search/tile/{article_id}/{tile_index}/{chunk_index} → tile image
//
// All endpoints except /health require bearer auth + token bucket + credit spend.
// Cost: 3 cents per search query, 2 cents per pixelshot render, 10 cents per index build.

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { z } from "zod";
import { bearerAuth } from "../auth/middleware.js";
import { tokenBucket } from "../middleware/rate-limit.js";
import { spendLimit } from "../middleware/spend-limit.js";
import { getBalance, deductCredits } from "../credits/index.js";
import { createInsufficientCreditsPayReq } from "../credits/insufficient-credits.js";
import { trackApiKeySpend } from "../inference/handler-helpers.js";
import type { OmaEnv } from "../types.js";

const execFileAsync = promisify(execFile);

// PixelRAG serve endpoint — self-hosted on port 30001 (configurable)
const PIXELRAG_BASE = process.env.PIXELRAG_BASE_URL ?? "http://localhost:30001";
const PIXELRAG_INDEX_DIR = process.env.PIXELRAG_INDEX_DIR ?? "/Users/tyson/data/pixelrag/index";
const PIXELRAG_TILES_DIR = process.env.PIXELRAG_TILES_DIR ?? "/Users/tyson/data/pixelrag/index";
const PIXELRAG_ARTICLES_JSON = process.env.PIXELRAG_ARTICLES_JSON ?? "/Users/tyson/data/pixelrag/index/articles.json";
const PIXELRAG_MODEL = process.env.PIXELRAG_MODEL ?? "Qwen/Qwen3-VL-Embedding-2B";
const PIXELRAG_PYTHON = "/Users/tyson/.local/share/uv/tools/pixelrag/bin/python";

const SEARCH_COST_CENTS = 3;
const SHOT_COST_CENTS = 2;
const INDEX_COST_CENTS = 10;

export const pixelSearchRoutes = new Hono<OmaEnv>();

// ── Health (no auth, no rate limit, no credit spend) ──────────────────────
// Important: defined BEFORE the auth/rate-limit middleware so users can
// always probe whether the local pixelrag serve is up without consuming a
// token or needing a bearer key.
pixelSearchRoutes.get("/v1/pixel-search/health", async (c) => {
  try {
    const [health, status] = await Promise.all([
      fetch(`${PIXELRAG_BASE}/health`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${PIXELRAG_BASE}/status`, { signal: AbortSignal.timeout(3000) }).catch(() => null),
    ]);
    const payload: Record<string, unknown> = {
      status: health.ok ? "ok" : "degraded",
      upstream: health.status,
    };
    if (status?.ok) {
      const s = (await status.json()) as Record<string, unknown>;
      payload.index = {
        vectors: s.total_vectors,
        dimension: s.dimension,
        model: s.model,
        index_built_at: s.index_built_at,
      };
    }
    return c.json(payload);
  } catch {
    return c.json(
      {
        status: "unreachable",
        upstream: null,
        hint:
          "Start the local pixelrag serve: pixelrag serve --index-dir " +
          PIXELRAG_INDEX_DIR +
          " --tiles-dir " +
          PIXELRAG_TILES_DIR +
          " --articles-json " +
          PIXELRAG_ARTICLES_JSON +
          " --model " +
          PIXELRAG_MODEL +
          " --device mps --port 30001",
      },
      502,
    );
  }
});

// Auth + rate-limit + spend-limit apply to everything BELOW this point.
pixelSearchRoutes.use("/v1/pixel-search/*", bearerAuth);
pixelSearchRoutes.use(
  "/v1/pixel-search/*",
  tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }),
);
pixelSearchRoutes.use("/v1/pixel-search/*", spendLimit());

// ── Status — full index stats ───────────────────────────────────────────
pixelSearchRoutes.get("/v1/pixel-search/status", async (c) => {
  try {
    const res = await fetch(`${PIXELRAG_BASE}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return c.json({ error: `Upstream ${res.status}` }, 502);
    return c.json(await res.json());
  } catch {
    return c.json({ error: "pixelrag serve unreachable" }, 504);
  }
});

// ── Search — text or image queries against the local index ──────────────
const querySchema = z.union([
  z.object({
    text: z.string().min(1).max(2000),
  }),
  z.object({
    image: z.string().regex(/^(https?:\/\/|data:image\/)/, "image must be URL or data URL"),
  }),
]);

const searchSchema = z.object({
  queries: z.array(querySchema).min(1).max(5),
  n_docs: z.number().int().min(1).max(50).optional().default(10),
  nprobe: z.number().int().min(1).optional(),
  min_tile_height: z.number().int().min(64).optional(),
  instruction: z.string().max(500).optional(),
  include_images: z.boolean().optional().default(false),
  articles_only: z.boolean().optional().default(false),
  department: z.string().optional(),
});

pixelSearchRoutes.post("/v1/pixel-search", async (c) => {
  const parsed = searchSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const bal = await getBalance(userId);
  const totalCost = SEARCH_COST_CENTS * parsed.data.queries.length;
  if (Number(bal.balanceCents) < totalCost) {
    return createInsufficientCreditsPayReq(c, totalCost, Number(bal.balanceCents));
  }

  // Map our schema → pixelrag SearchRequest
  const upstreamBody: Record<string, unknown> = {
    queries: parsed.data.queries,
    n_docs: parsed.data.n_docs,
    include_images: parsed.data.include_images,
  };
  if (parsed.data.nprobe) upstreamBody.nprobe = parsed.data.nprobe;
  if (parsed.data.min_tile_height) upstreamBody.min_tile_height = parsed.data.min_tile_height;
  if (parsed.data.instruction) upstreamBody.instruction = parsed.data.instruction;
  if (parsed.data.articles_only) upstreamBody.articles_only = parsed.data.articles_only;
  if (parsed.data.department) upstreamBody.department = parsed.data.department;

  try {
    const res = await fetch(`${PIXELRAG_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const body = await res.text();
      return c.json({ error: `Upstream error: ${res.status}`, detail: body }, 502);
    }

    const data = await res.json();

    const requestId = randomUUID();
    await deductCredits(
      userId,
      totalCost,
      0,
      totalCost,
      "pixelrag-visual-search",
      "tinyfish",
      apiKey?.id ?? "",
      0,
      0,
      requestId,
    );
    trackApiKeySpend(apiKey?.keyHash, totalCost);

    return c.json({
      index: {
        model: PIXELRAG_MODEL,
        base: PIXELRAG_BASE,
        ...(parsed.data.department ? { department: parsed.data.department } : {}),
      },
      cost_cents: totalCost,
      ...data,
    });
  } catch {
    return c.json({ error: "pixelrag serve timeout or network error" }, 504);
  }
});

// ── Tile image — fetch a specific tile from the index ───────────────────
pixelSearchRoutes.get(
  "/v1/pixel-search/tile/:article_id/:tile_index/:chunk_index",
  async (c) => {
    const { article_id, tile_index, chunk_index } = c.req.param();
    try {
      const url = `${PIXELRAG_BASE}/tile/${encodeURIComponent(article_id)}/${tile_index}/${chunk_index}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return c.json({ error: `Tile ${res.status}` }, 404);
      return new Response(res.body, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      return c.json({ error: "tile fetch failed" }, 504);
    }
  },
);

// ── Pixelshot — render new pages/PDFs locally ───────────────────────────
const shotSchema = z.object({
  urls: z.array(z.string().min(1)).min(1).max(10),
  tile_height: z.number().int().min(512).max(16384).optional().default(8192),
  quality: z.number().int().min(1).max(100).optional().default(85),
  viewport_width: z.number().int().min(320).max(3840).optional().default(875),
  wait_network_idle: z.boolean().optional().default(false),
  output_dir: z.string().optional(),
});

pixelSearchRoutes.post("/v1/pixel-shot", async (c) => {
  const parsed = shotSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const bal = await getBalance(userId);
  const totalCost = SHOT_COST_CENTS * parsed.data.urls.length;
  if (Number(bal.balanceCents) < totalCost) {
    return createInsufficientCreditsPayReq(c, totalCost, Number(bal.balanceCents));
  }

  const { urls, tile_height, quality, viewport_width, wait_network_idle, output_dir } =
    parsed.data;

  try {
    const outDir = output_dir ?? `/tmp/pixelrag-oma/${Date.now()}`;
    const args = [
      ...urls,
      "--tile-height",
      String(tile_height),
      "--quality",
      String(quality),
      "--viewport-width",
      String(viewport_width),
      "-o",
      outDir,
    ];
    if (wait_network_idle) args.push("--wait-network-idle");

    const { stdout, stderr } = await execFileAsync("pixelshot", args, {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });

    const requestId = randomUUID();
    await deductCredits(
      userId,
      totalCost,
      0,
      totalCost,
      "pixelshot-render",
      "tinyfish",
      apiKey?.id ?? "",
      0,
      0,
      requestId,
    );
    trackApiKeySpend(apiKey?.keyHash, totalCost);

    // Parse tile outputs from stdout — line per URL
    const tileDirs = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.endsWith(".png.tiles"));

    return c.json({
      tool: "pixelshot",
      output_dir: outDir,
      outputs: tileDirs,
      log: stderr.slice(0, 1000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return c.json({ error: `pixelshot failed: ${msg}` }, 500);
  }
});

// ── Index build — run pixelrag index pipeline over a local corpus ───────
const indexSchema = z.object({
  source_path: z.string().min(1).describe("Directory of files to index"),
  index_dir: z.string().optional(),
  tiles_dir: z.string().optional(),
  model: z.string().optional(),
  force: z.boolean().optional().default(false),
});

pixelSearchRoutes.post("/v1/pixel-index", async (c) => {
  const parsed = indexSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) < INDEX_COST_CENTS) {
    return createInsufficientCreditsPayReq(c, INDEX_COST_CENTS, Number(bal.balanceCents));
  }

  const { source_path, index_dir, tiles_dir, model, force } = parsed.data;

  // Verify source path exists
  try {
    const stat = await fs.stat(source_path);
    if (!stat.isDirectory()) {
      return c.json({ error: "source_path must be a directory" }, 400);
    }
  } catch {
    return c.json({ error: `source_path not accessible: ${source_path}` }, 404);
  }

  // Write a pixelrag.yaml config
  const outIdx = index_dir ?? PIXELRAG_INDEX_DIR;
  const outTiles = tiles_dir ?? PIXELRAG_TILES_DIR;
  const cfgPath = `/tmp/pixelrag-cfg-${Date.now()}.yaml`;
  const { stringify: yamlStringify } = await import("yaml");
  const cfgObj = {
    source: { type: "local", path: source_path },
    ingest: { backend: "cdp", quality: 85, tile_height: 8192 },
    embed: { model: model ?? PIXELRAG_MODEL, device: "cpu" },
    output: outIdx,
    tiles_dir: outTiles,
  };
  await fs.writeFile(cfgPath, yamlStringify(cfgObj));

  // Deduct first, run async
  const requestId = randomUUID();
  await deductCredits(
    userId,
    INDEX_COST_CENTS,
    0,
    INDEX_COST_CENTS,
    "pixelrag-index-build",
    "tinyfish",
    apiKey?.id ?? "",
    0,
    0,
    requestId,
  );
  trackApiKeySpend(apiKey?.keyHash, INDEX_COST_CENTS);

  // Spawn the build — runs in background, returns job id
  const jobId = randomUUID();
  const logPath = `/tmp/pixelrag-index-${jobId}.log`;
  const args = [
    "-m",
    "pixelrag_index.pipelines",
    "build",
    "--config",
    cfgPath,
  ];
  if (force) args.push("--force");
  const proc = spawn(PIXELRAG_PYTHON, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logStream = (await import("node:fs")).createWriteStream(logPath);
  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);
  proc.unref();

  return c.json({
    job_id: jobId,
    status: "started",
    log_path: logPath,
    source: source_path,
    index_dir: outIdx,
    tiles_dir: outTiles,
    cost_cents: INDEX_COST_CENTS,
  });
});
