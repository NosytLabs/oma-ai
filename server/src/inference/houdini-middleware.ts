// ponytail: shared Houdini configuration check middleware
import type { Context } from "hono";
import { houdiniClient } from "../credits/houdini-client.js";

/**
 * Returns an early-return 503 Response if HoudiniSwap is not configured,
 * or null if the request should proceed.
 *
 * Uses houdiniClient.isConfigured() which checks HOUDINI_API_KEY,
 * HOUDINI_API_SECRET, and HOUDINI_PARTNER_ID.
 */
export function requireHoudini(c: Context): Response | null {
  if (!houdiniClient.isConfigured()) {
    return c.json(
      {
        error: {
          message: "HoudiniSwap is not configured on this server.",
          type: "configuration_error",
        },
      },
      503,
    );
  }
  return null; // proceed
}
