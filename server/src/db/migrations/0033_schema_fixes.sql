-- Migration 0033: Schema fixes — nullable api_key_id, team_members PK, JSONB columns, FK indexes
--
-- 1. usage_records.api_key_id: remove NOT NULL (was incompatible with onDelete:"set null")
-- 2. team_members: add composite primary key (team_id, user_id) — prevents duplicate memberships
-- 3. plans.features: TEXT → JSONB (structured plan feature flags)
-- 4. audit_logs.metadata: TEXT → JSONB (structured audit metadata)
-- 5. sso_connections.metadata: TEXT → JSONB (structured SSO config)
-- 6. Add FK indexes: credit_batches(deposit_id), refund_requests(deposit_id, decided_by), subscriptions(plan_id)

-- 1. Make api_key_id nullable in usage_records
ALTER TABLE usage_records ALTER COLUMN api_key_id DROP NOT NULL;

-- 2. Add composite primary key to team_members
-- Drop the non-unique composite index first (will be recreated without PK role)
DROP INDEX IF EXISTS idx_team_members_team_user;
-- Add composite primary key
ALTER TABLE team_members ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id);

-- 3. Convert plans.features TEXT → JSONB
ALTER TABLE plans ALTER COLUMN features TYPE jsonb USING features::jsonb;

-- 4. Convert audit_logs.metadata TEXT → JSONB
ALTER TABLE audit_logs ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb;

-- 5. Convert sso_connections.metadata TEXT → JSONB
ALTER TABLE sso_connections ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb;

-- 6. Add missing FK indexes
CREATE INDEX idx_credit_batches_deposit ON credit_batches (deposit_id);
CREATE INDEX idx_refund_requests_deposit ON refund_requests (deposit_id);
CREATE INDEX idx_refund_requests_decided_by ON refund_requests (decided_by);
CREATE INDEX idx_subscriptions_plan ON subscriptions (plan_id);
