-- Soft-delete des règles de relance : conserve les logs historiques
ALTER TABLE "reminder_rules" ADD COLUMN "archived_at" TIMESTAMP(3);
CREATE INDEX "reminder_rules_archived_at_idx" ON "reminder_rules"("archived_at");
