/**
 * Back-compat re-export. Next only loads `middleware.ts` — keep this file
 * so older imports of `./proxy` still resolve to the same edge handler.
 */
export { middleware as proxy, config } from "./middleware";
