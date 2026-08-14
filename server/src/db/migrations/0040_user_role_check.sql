-- Migration 0040: User role CHECK constraint
--
-- SECURITY (audit 1.6 / MEDIUM): the `user.role` column was free-form
-- TEXT, so a typo (`"Admin"`, `"admins"`, etc.) could accidentally grant
-- the requireAdmin() gate. Enforce a CHECK constraint matching the
-- Better Auth admin plugin's `adminRoles` config in server/src/auth.ts.
-- Existing rows are coerced to "user" first so the CHECK constraint can
-- be applied without violating historical data.

-- 1. Coerce any out-of-spec values to "user" so the CHECK constraint
--    can be applied without violating historical data. The set of valid
--    values matches Better Auth's adminRoles plugin config.
UPDATE "user"
SET role = 'user'
WHERE role IS NOT NULL
  AND role NOT IN ('admin', 'user');

-- 2. Apply the constraint.
ALTER TABLE "user"
  DROP CONSTRAINT IF EXISTS "user_role_check";
--> statement-breakpoint

ALTER TABLE "user"
  ADD CONSTRAINT "user_role_check"
  CHECK (role IS NULL OR role IN ('admin', 'user'));
