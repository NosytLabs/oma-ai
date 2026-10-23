CREATE TABLE "inference_credit_reservations" (
  "request_id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE CASCADE,
  "reserved_cents" numeric(18,8) NOT NULL CHECK (reserved_cents >= 0),
  "state" text NOT NULL DEFAULT 'held' CHECK (state IN ('held','settled','released','reconciliation')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "idx_inference_credit_reservations_user" ON "inference_credit_reservations" ("user_id");
CREATE INDEX "idx_inference_credit_reservations_state" ON "inference_credit_reservations" ("state", "created_at");
ALTER TABLE "usage_records" ADD COLUMN "provider_response_id" text;
ALTER TABLE "usage_records" ADD COLUMN "usage_verified" boolean NOT NULL DEFAULT false;

-- Anonymous accounting evidence survives customer history/account deletion.
CREATE TABLE "inference_financial_receipts" (
  "request_id" text PRIMARY KEY,
  "requested_model" text,
  "model" text,
  "provider" text,
  "provider_response_id" text,
  "reserved_cents" numeric(18,8) NOT NULL DEFAULT 0,
  "cost_cents" numeric(18,8) NOT NULL DEFAULT 0,
  "charged_cents" numeric(18,8) NOT NULL DEFAULT 0,
  "refunded_cents" numeric(18,8) NOT NULL DEFAULT 0,
  "cost_known" boolean NOT NULL DEFAULT false,
  "usage_verified" boolean NOT NULL DEFAULT false,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "pricing_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "state" text NOT NULL DEFAULT 'held',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "idx_inference_financial_receipts_state" ON "inference_financial_receipts" ("state", "created_at");
