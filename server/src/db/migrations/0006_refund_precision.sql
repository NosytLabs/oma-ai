-- Match usage/credit precision. Existing values remain unchanged; no automatic
-- reconciliation of historical decisions or previously rounded amounts.
ALTER TABLE "refund_requests" ALTER COLUMN "amount_cents" TYPE numeric(18,8);
