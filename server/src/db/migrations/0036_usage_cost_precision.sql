-- Migration 0036: Increase usage_records cost precision from 2 to 8 decimal places
-- Sub-cent costs are common for per-token billing (e.g. 0.0074 cents for a small request)

ALTER TABLE usage_records ALTER COLUMN cost_cents TYPE numeric(18, 8);
ALTER TABLE usage_records ALTER COLUMN markup_cents TYPE numeric(18, 8);
ALTER TABLE usage_records ALTER COLUMN total_cents TYPE numeric(18, 8);

-- Also increase credit_balances precision
ALTER TABLE credit_balances ALTER COLUMN balance_cents TYPE numeric(18, 8);
ALTER TABLE credit_balances ALTER COLUMN total_deposited_cents TYPE numeric(18, 8);
ALTER TABLE credit_balances ALTER COLUMN total_used_cents TYPE numeric(18, 8);
