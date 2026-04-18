-- ─── Reminder Rules : restructuration ────────────────────────────────────────
-- Supprime la FK vers formations (plus de rule par formation)
ALTER TABLE "reminder_rules" DROP CONSTRAINT IF EXISTS "reminder_rules_formation_id_fkey";

-- Ajoute les nouvelles colonnes avec defaults temporaires pour les lignes existantes
ALTER TABLE "reminder_rules" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Relance modules bloques';
ALTER TABLE "reminder_rules" ADD COLUMN "send_hour" INTEGER NOT NULL DEFAULT 9;
ALTER TABLE "reminder_rules" ADD COLUMN "template_name" TEXT NOT NULL DEFAULT 'reminder_stalled_modules_v1';

-- Retire les defaults (Prisma schema n'en définit pas sur ces colonnes)
ALTER TABLE "reminder_rules" ALTER COLUMN "name" DROP DEFAULT;
ALTER TABLE "reminder_rules" ALTER COLUMN "template_name" DROP DEFAULT;

-- Supprime les anciennes colonnes
ALTER TABLE "reminder_rules" DROP COLUMN "formation_id";
ALTER TABLE "reminder_rules" DROP COLUMN "send_window_start_hour";
ALTER TABLE "reminder_rules" DROP COLUMN "send_window_end_hour";
ALTER TABLE "reminder_rules" DROP COLUMN "template_id";
ALTER TABLE "reminder_rules" DROP COLUMN "created_by";

CREATE INDEX "reminder_rules_template_name_idx" ON "reminder_rules"("template_name");

-- ─── Reminder Templates : nouvelle table ─────────────────────────────────────
CREATE TABLE "reminder_templates" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "version"       INTEGER NOT NULL,
  "subject"       TEXT NOT NULL,
  "html_content"  TEXT NOT NULL,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reminder_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reminder_templates_name_version_key" ON "reminder_templates"("name", "version");
CREATE INDEX "reminder_templates_name_is_active_idx" ON "reminder_templates"("name", "is_active");
