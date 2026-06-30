import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";

export const byokRoutes = new Hono<OmaEnv>();

const GONE = {
  error: {
    message: "BYOK management was retired when non-private providers were removed. OMA now routes exclusively through Venice-based providers.",
    type: "service_unavailable",
  },
};

byokRoutes.get("/admin/byok", async (c) => c.json(GONE, 503));
byokRoutes.post("/admin/byok", async (c) => c.json(GONE, 503));
byokRoutes.delete("/admin/byok/:id", async (c) => c.json(GONE, 503));
byokRoutes.post("/admin/byok/venice", async (c) => c.json(GONE, 503));
byokRoutes.post("/admin/byok/ordering", async (c) => c.json(GONE, 503));
