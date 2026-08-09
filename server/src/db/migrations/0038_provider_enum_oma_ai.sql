-- 0038_provider_enum_oma_ai.sql
-- Rebrand provider enum value 'gonka' → 'oma-ai' (Zyloo/OpenBroker split).
-- Historical usage rows are preserved via rename; environments that never
-- had 'gonka' simply get the new 'oma-ai' label added.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'provider' AND e.enumlabel = 'gonka'
  ) THEN
    ALTER TYPE provider RENAME VALUE 'gonka' TO 'oma-ai';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'provider' AND e.enumlabel = 'oma-ai'
  ) THEN
    ALTER TYPE provider ADD VALUE 'oma-ai';
  END IF;
END $$;
