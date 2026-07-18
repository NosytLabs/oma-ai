-- Migration 0034: Drop redundant usage_records indexes
--
-- The following indexes are redundant and covered by composite indexes:
-- 1. idx_usage_user (userId)           -> covered by idx_usage_user_created (userId, createdAt)
-- 2. idx_usage_created (createdAt)     -> covered by idx_usage_records_analytics (createdAt, model, provider, costCents)
-- 3. idx_usage_model (model)           -> covered by idx_usage_user_created_model (userId, createdAt, model)
-- 4. idx_usage_request (requestId)     -> covered by uq_usage_request_id (unique index on requestId)
-- 5. idx_usage_api_key (apiKeyId)      -> rarely used standalone; queries filter by userId
-- 6. idx_usage_records_provider (provider) -> covered by idx_usage_records_analytics (createdAt, model, provider, costCents)
-- 7. idx_usage_user_status_created (userId, status, createdAt) -> KEEP per audit (different query pattern: status filtering)
-- 8. idx_usage_user_created (userId, createdAt) -> KEEP (primary query pattern)
-- 9. idx_usage_user_created_model (userId, createdAt, model) -> KEEP (detailed queries)
-- 10. idx_usage_records_analytics (createdAt, model, provider, costCents) -> KEEP (analytics)

DROP INDEX IF EXISTS idx_usage_user;
DROP INDEX IF EXISTS idx_usage_model;
DROP INDEX IF EXISTS idx_usage_created;
DROP INDEX IF EXISTS idx_usage_request;
DROP INDEX IF EXISTS idx_usage_api_key;
DROP INDEX IF EXISTS idx_usage_records_provider;
