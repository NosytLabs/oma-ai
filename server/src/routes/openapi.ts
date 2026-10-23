import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { config } from "../config.js";
import { buildPublicOpenApiSpec } from "./openapi-spec.js";

export { getOpenApiServers } from "./openapi-spec.js";
export const openapiRoutes = new Hono<OmaEnv>();

export function getPublicOpenApiSpec() {
 return buildPublicOpenApiSpec({
  publicApiUrl: config.PUBLIC_API_URL, localPort: config.PORT,
  appUrl: config.PUBLIC_APP_URL, nodeEnv: config.NODE_ENV,
 });
}

for (const path of ["/openapi.json", "/openapi", "/v1/openapi.json", "/v1/openapi"]) {
 openapiRoutes.get(path, (c) => c.json(getPublicOpenApiSpec()));
}
