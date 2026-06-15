-- Migration 0027: SYNC-39 — migrate 3 text columns to structured types
--
-- Changes:
--   1. budget_alerts.alert_thresholds  text → integer[]
--   2. invoices.line_items             text → jsonb
--   3. webhook_subscriptions.events    text → text[]
--
-- Each ALTER uses a USING clause to convert existing data in-place.
-- No data loss: JSON-array text values are parsed into native Postgres arrays.
-- The default for alert_thresholds is changed from JSON-string '[50,75,90,100]'
-- to Postgres integer-array '{50,75,90,100}'.
--
-- Run after verifying the app code no longer calls JSON.parse/stringify on these columns.

--> statement-breakpoint

-- 1. budget_alerts.alert_thresholds: text → integer[]
ALTER TABLE "budget_alerts"
  ALTER COLUMN "alert_thresholds"
  TYPE integer[]
  USING (
    SELECT array_agg(e::int)
    FROM jsonb_array_elements_text("alert_thresholds"::jsonb) e
  );
--> statement-breakpoint
ALTER TABLE "budget_alerts"
  ALTER COLUMN "alert_thresholds"
  SET DEFAULT '{50,75,90,100}';
--> statement-breakpoint

-- 2. invoices.line_items: text → jsonb
ALTER TABLE "invoices"
  ALTER COLUMN "line_items"
  TYPE jsonb
  USING "line_items"::jsonb;
--> statement-breakpoint

-- 3. webhook_subscriptions.events: text → text[]
ALTER TABLE "webhook_subscriptions"
  ALTER COLUMN "events"
  TYPE text[]
  USING (
    CASE
      WHEN "events" IS NULL THEN NULL
      ELSE (SELECT array_agg(e) FROM jsonb_array_elements_text("events"::jsonb) e)
    END
  );
