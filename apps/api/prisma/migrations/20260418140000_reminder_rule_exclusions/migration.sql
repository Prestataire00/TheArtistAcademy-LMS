-- Exclusions configurables sur les règles de relance
ALTER TABLE "reminder_rules"
  ADD COLUMN "exclude_completed"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "exclude_expired"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "exclude_unenrolled" BOOLEAN NOT NULL DEFAULT true;
