import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";
import { usdcRoutes } from "./usdc.js";
import { houdiniRoutes } from "./houdini.js";
import { cctpRoutes } from "./cctp.js";
import { lifiRoutes } from "./lifi.js";
import { balanceRoutes } from "./balance.js";
import { depositRouter } from "./router.js";
import { depositStatusRoutes } from "./status.js";

export const depositRoutes = new Hono<OmaEnv>();

depositRoutes.route("/", usdcRoutes);
depositRoutes.route("/", houdiniRoutes);
depositRoutes.route("/", cctpRoutes);
depositRoutes.route("/", lifiRoutes);
depositRoutes.route("/", balanceRoutes);
depositRoutes.route("/", depositRouter);
depositRoutes.route("/", depositStatusRoutes);