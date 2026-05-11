-- Phase 2 : capture IP + pays au premier passage de l'UA à `completed`.
-- Conformité Qualiopi/CPF — cf. PRD section 8 (Logs & Traçabilité).
-- Migration non destructive : 2 colonnes nullables ajoutées.

ALTER TABLE "ua_progresses" ADD COLUMN "ip_address" TEXT;
ALTER TABLE "ua_progresses" ADD COLUMN "country"    TEXT;
