-- Migration : passage de role (UserRole unique) à roles (UserRole[]).
-- Stratégie non-destructive en 4 étapes :
--   1. Ajouter la colonne `roles` UserRole[] avec un default vide (NULL autorisé).
--   2. Backfiller : roles = ARRAY[role] pour chaque ligne existante.
--   3. Rendre la colonne NOT NULL avec default ARRAY['learner']::"UserRole"[].
--   4. Supprimer l'ancienne colonne `role` (uniquement après backfill complet).

-- Step 1 : ajouter la colonne nullable, default vide
ALTER TABLE "users" ADD COLUMN "roles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[];

-- Step 2 : backfill depuis l'ancienne colonne `role`
UPDATE "users" SET "roles" = ARRAY["role"]::"UserRole"[] WHERE "role" IS NOT NULL;

-- Step 3 : NOT NULL + default 'learner'
ALTER TABLE "users" ALTER COLUMN "roles" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "roles" SET DEFAULT ARRAY['learner']::"UserRole"[];

-- Step 4 : drop ancienne colonne (sûr — backfill terminé)
ALTER TABLE "users" DROP COLUMN "role";
