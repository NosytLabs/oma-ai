/**
 * M10.4 — Public Vendor Meta route
 *
 * GET /v1/providers/meta
 *
 * Public (no auth) read-only endpoint returning the structured `VendorMeta`
 * array from `inference/vendor-meta.ts`. Used by:
 *   - app dashboard provider showcase
 *   - marketing /models page (server-side render of the 8 providers)
 *   - admin audit reports
 *
 * IMPORTANT: no API keys or secrets are in the response. `getVendorMeta()`
 * returns 8 hard-coded entries — see vendor-meta.ts for the full list.
 */
import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { getVendorMeta } from "../inference/vendor-meta.js";

export const providersMetaRoutes = new Hono<OmaEnv>();

providersMetaRoutes.get("/v1/providers/meta", async (c) => {
  const providers = await getVendorMeta();
  return c.json({
    count: providers.length,
    providers,
  });
});
