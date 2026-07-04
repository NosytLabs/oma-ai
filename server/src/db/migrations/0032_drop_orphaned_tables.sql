-- Migration 0032: Drop orphaned provider_affinity table
--
-- The provider_affinity table was created for affinity routing logic that was
-- ultimately replaced by Surplus P2P routing. It has 0 rows in production and
-- is not referenced anywhere in the application code.
-- The staking_tiers table is retained — it is queried by credits/staking.ts
-- and is intended for a future staking discount feature.

DROP TABLE IF EXISTS "provider_affinity";
