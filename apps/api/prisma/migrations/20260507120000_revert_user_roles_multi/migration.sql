-- Migration : retour mono-role. Inverse exact de 20260506120000_user_roles_multi.
-- Decision produit : le multi-roles ne reflete pas le besoin metier d'Artist
-- Academy, on revient a un seul role par utilisateur (UserRole).
--
-- Strategie non-destructive en 4 etapes (symetrique de l'aller) :
--   1. Ajouter la colonne `role` UserRole nullable (le default vient en step 3).
--   2. Backfiller : role = roles[1] (PostgreSQL est 1-indexe pour les arrays).
--      Les users actuels ont tous 1 seul role dans leur array, donc roles[1]
--      capture 100% de la donnee. Si jamais un user avait plusieurs roles
--      (ne devrait pas arriver vu la duree de la phase 2A), on prend le
--      premier — convention ordre d'insertion, pas de promotion implicite.
--   3. NOT NULL + default 'learner'.
--   4. Drop l'ancienne colonne `roles` (apres backfill complet uniquement).

-- Step 1 : ajouter la colonne nullable
ALTER TABLE "users" ADD COLUMN "role" "UserRole";

-- Step 2 : backfill depuis roles[1] (PostgreSQL arrays are 1-indexed)
UPDATE "users" SET "role" = "roles"[1] WHERE array_length("roles", 1) IS NOT NULL;

-- Step 3 : NOT NULL + default 'learner'
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'learner'::"UserRole";

-- Step 4 : drop la colonne `roles` (safe — backfill termine)
ALTER TABLE "users" DROP COLUMN "roles";
