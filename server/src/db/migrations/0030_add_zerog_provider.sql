-- Migration 0030: Add zerog provider to provider enum
-- Adds 'zerog' to the existing provider enum type.
-- Uses IF NOT EXISTS for idempotency — safe to re-run.

ALTER TYPE "public"."provider" ADD VALUE IF NOT EXISTS 'zerog';
