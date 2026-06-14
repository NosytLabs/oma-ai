-- Migration 0026: API Key IP Allowlist (G3)
-- Adds `ip_allowlist` to api_keys so users can lock a key to specific IPs/CIDRs.
-- Empty / NULL = all IPs allowed (no breaking change for existing keys).
-- Entries are IPv4 (e.g. "192.168.1.5"), IPv6 (e.g. "::1"), or CIDR blocks
-- (e.g. "10.0.0.0/8", "2001:db8::/32"). Validation happens in the auth layer
-- (server/src/auth/api-keys.ts → isValidIpOrCidr) before write.
--
-- Enforcement lives in server/src/auth/middleware.ts (bearerAuth) and
-- reads via server/src/middleware/rate-limit/utils.ts → extractClientIp().
-- Backfill: existing rows are left as NULL, which the middleware treats
-- as "no restriction" — same as today's behavior. No row rewrite.

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "ip_allowlist" text[] NULL;
