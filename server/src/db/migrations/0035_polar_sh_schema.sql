-- 0035_polar_sh_schema.sql
-- Polar.sh payment integration schema
-- Adds polar_customers, polar_subscriptions, polar_orders, polar_license_keys,
-- polar_webhook_events tables for Polar.sh billing integration.
--
-- Table names are `polar_*` prefixed to avoid colliding with the existing
-- `subscriptions` table (which tracks internal plan subscriptions) and the
-- `webhook_subscriptions` table (user-driven webhook fan-out). The Drizzle
-- schema in db/schema.ts must stay in sync with these column definitions.

-- ============================================================================
-- POLAR_CUSTOMERS
-- Links our users to Polar.sh customer IDs
-- ============================================================================
CREATE TABLE IF NOT EXISTS polar_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    polar_customer_id TEXT NOT NULL UNIQUE,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polar_customers_user_id ON polar_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_polar_customers_polar_id ON polar_customers(polar_customer_id);

-- ============================================================================
-- POLAR_SUBSCRIPTIONS
-- Tracks active subscriptions from Polar.sh (does NOT collide with the
-- existing `subscriptions` table; that one tracks internal plans).
-- ============================================================================
CREATE TABLE IF NOT EXISTS polar_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES polar_customers(id) ON DELETE CASCADE,
    polar_subscription_id TEXT NOT NULL UNIQUE,
    polar_product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_customer_id ON polar_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_polar_id ON polar_subscriptions(polar_subscription_id);
CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_status ON polar_subscriptions(status);

-- ============================================================================
-- POLAR_ORDERS
-- Records all purchases from Polar.sh
-- ============================================================================
CREATE TABLE IF NOT EXISTS polar_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES polar_customers(id) ON DELETE CASCADE,
    polar_order_id TEXT NOT NULL UNIQUE,
    polar_product_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polar_orders_customer_id ON polar_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_polar_orders_polar_id ON polar_orders(polar_order_id);

-- ============================================================================
-- POLAR_LICENSE_KEYS
-- For lifetime/perpetual licenses sold via Polar.sh
-- ============================================================================
CREATE TABLE IF NOT EXISTS polar_license_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES polar_customers(id) ON DELETE CASCADE,
    polar_order_id TEXT NOT NULL,
    license_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    activated_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    validation_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polar_license_keys_customer_id ON polar_license_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_polar_license_keys_license_key ON polar_license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_polar_license_keys_polar_order_id ON polar_license_keys(polar_order_id);

-- ============================================================================
-- POLAR_WEBHOOK_EVENTS
-- Audit log of inbound Polar.sh webhook events for debugging + replay
-- ============================================================================
CREATE TABLE IF NOT EXISTS polar_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polar_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polar_webhook_events_event_type ON polar_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_polar_webhook_events_processed ON polar_webhook_events(processed);