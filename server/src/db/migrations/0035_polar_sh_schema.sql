-- 0035_polar_sh_schema.sql
-- Polar.sh payment integration schema
-- Adds customers, subscriptions, license_keys, and orders tables for Polar.sh billing

-- ============================================================================
-- CUSTOMERS
-- Links our users to Polar.sh customer IDs
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL UNIQUE,
    polar_customer_id TEXT NOT NULL UNIQUE,
    email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_polar_customer_id ON customers(polar_customer_id);

-- ============================================================================
-- SUBSCRIPTIONS
-- Tracks active subscriptions from Polar.sh
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_id TEXT NOT NULL,
    polar_subscription_id TEXT NOT NULL UNIQUE,
    polar_product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_polar_subscription_id ON subscriptions(polar_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================================
-- LICENSE KEYS
-- For lifetime/perpetual licenses sold via Polar.sh
-- ============================================================================
CREATE TABLE IF NOT EXISTS license_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_id TEXT NOT NULL,
    polar_order_id TEXT NOT NULL,
    license_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    activated_at TEXT,
    last_validated_at TEXT,
    validation_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_license_keys_customer_id ON license_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_license_key ON license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_license_keys_polar_order_id ON license_keys(polar_order_id);

-- ============================================================================
-- ORDERS
-- Records all purchases from Polar.sh
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_id TEXT NOT NULL,
    polar_order_id TEXT NOT NULL UNIQUE,
    polar_product_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_polar_order_id ON orders(polar_order_id);

-- ============================================================================
-- WEBHOOK EVENTS LOG
-- Stores raw Polar.sh webhook events for debugging and replay
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    polar_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
