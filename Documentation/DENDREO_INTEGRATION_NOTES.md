# Intégration Dendreo — Notes de tests

> Document de référence pour l'intégration avec le Connecteur LMS Universel Dendreo.
> Dernière mise à jour : 08/05/2026 — **Phase 2B livrée (refonte handler `user.created`, bug c résolu, déployée en prod)**.

---

## 1. Environnements

| Environnement | URL admin | Connecteur LMS Universel |
|---|---|---|
| Sandbox | `https://pro.dendreo.com/the_artist_academy_sandbox` | ✅ Activé (06/05/2026) |
| Prod | (à compléter) | ⏸️ En attente go-live |

**Extranet sandbox** : `https://extranet-the-artist-academy-sandbox.dendreo.com`

---

## 2. Authentification — secrets Dendreo

Trois secrets distincts coexistent côté Dendreo. Ne pas les confondre :

| Variable | Rôle | Configurée sur |
|---|---|---|
| `DENDREO_API_KEY` | Clé API Dendreo (axe LMS → Dendreo, ex : `participants.php`) | Service **API uniquement** |
| `DENDREO_SIGNATURE_KEY` | Clé du Connecteur LMS Universel — signe les webhooks `user/enrolment/session` **et** les JWT du SSO | Service **API uniquement** |
| `DENDREO_WEBHOOK_SECRET` | Clé d'un autre système de webhooks Dendreo | ❌ Non utilisé par le LMS |

> ⚠️ **Important** : ces secrets ne sont **PAS** exposés sur le service Web Railway, par principe de moindre exposition. Seules les variables `NEXT_PUBLIC_*` sont configurées côté Web (notamment `NEXT_PUBLIC_API_URL`).

**Modes de transmission de la clé API** :

| Méthode | Format | Statut |
|---|---|---|
| Query string | `?key=TA_CLE_API` | ✅ Validé sur sandbox |
| Header | `X-Auth-API-Key: TA_CLE_API` | À tester si besoin |

---

## 3. Endpoints validés (axe LMS → Dendreo)

### 3.1 Récupérer une entreprise

```bash
curl -s "https://pro.dendreo.com/the_artist_academy_sandbox/api/entreprises.php?key=KEY&id_entreprise=2223"
```

### 3.2 Lister / récupérer un participant

```bash
curl -s "https://pro.dendreo.com/the_artist_academy_sandbox/api/participants.php?key=KEY&id_participant=2252"
```

**Champs critiques** :

| Champ | Description | Quand est-il rempli ? |
|---|---|---|
| `id_participant` | ID Dendreo du participant | Toujours |
| `email` | Email du participant | À la création |
| `extranet_url` | URL base de l'extranet | Toujours |
| `extranet_code` | Code unique d'autologin | **Après inscription à une ADF** |
| `extranet_autologin_url` | URL d'autologin direct | **Après inscription à une ADF** |
| `lmsuniversel_user_id` | ID utilisateur côté LMS | Renseigné par le LMS via webhook `user.created` |

---

## 4. Comportement validé : `extranet_autologin_url`

`extranet_autologin_url` est **vide tant que le participant n'est pas inscrit à une ADF**.

### Avant inscription
```json
"extranet_code": "",
"extranet_autologin_url": ""
```

### Après inscription à une ADF
```json
"extranet_code": "845-528-430",
"extranet_autologin_url": "https://extranet-the-artist-academy-sandbox.dendreo.com/autologin/845528430"
```

### Implémentation LMS

Au webhook `enrolment.created`, le LMS pull `extranet_autologin_url` via `GET /api/participants.php?id_participant=X` et le stocke sur l'enrollment, pour usage dans les emails de relance (`{{lien_extranet}}`). Fallback `extranet_url` si vide.

---

## 5. Données de test sandbox (06/05/2026)

| Type | ID | Identifiant |
|---|---|---|
| Particulier | `id_participant: 2252` | TEST EVA — `eva.randrianasolo@gmail.com` |
| Particulier | `id_participant: 2254` | TEST Marc — `eva.randrianasolo+marc@gmail.com` |
| Module e-learning | (lié au LMS) | `Test 2 LMS TAA - Module e-learning` |
| ADF | `ADF_20260126` | `Test 2 LMS TAA` |
| DendreoSession (DB LMS) | `externalId: 8165` | — |
| Enrollments | 2 créés via webhooks | EVA + Marc |

---

## 6. Validations effectuées (axe Dendreo → LMS)

| Test | Validation | Statut |
|---|---|---|
| Pull trainings (LMS → Dendreo) | L'admin Dendreo voit les 5 formations LMS lors de l'association d'un module e-learning | ✅ |
| Webhook `session.created` | Persistance en DB Supabase, log structuré | ✅ |
| Webhook `user.created` (×2) | Création user en DB, bridge `lmsuniversel_user_id` synchronisé | ✅ |
| Webhook `enrolment.created` (×2) | Création enrollment en DB, lien session ↔ enrollment | ✅ |
| SSO JWT depuis extranet apprenant | Clic "Accéder au module e-learning" → page formation LMS, authentifié, sans saisie d'identifiants | ✅ |
| Remontée progression | À tester en prod — logique implémentée et testée en local | ⏸️ |

---

## 7. Configuration appliquée du connecteur

### Section "Réglage de la connexion"
- **Nom du LMS** : `TAALMS`
- **Tenant ID** : `taa-formation-test` *(sandbox — à renommer pour la prod)*
- **Clé de signature** : copiée dans `DENDREO_SIGNATURE_KEY` (Railway service API uniquement)

### Section "Accès API"
- **URL endpoint Trainings** : `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/trainings`
- **Header** : `{"X-Auth-API-Key": "<DENDREO_API_KEY>"}`
- **Champ ID / titre / description** : `training_id` / `training_title` / `training_description`

### Section "Webhooks"

| Événement | URL |
|---|---|
| Création utilisateur | `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/users` |
| Inscription | `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/enrolments` |
| Création session | `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/sessions` |

### Section "Accès au LMS par les Participants"
- **URL de redirection** : `https://artist-academyweb-production.up.railway.app/formations/[training_id]?enrolment=[enrolment_id]`
- **URL endpoint JWT SSO** : `https://artist-academyapi-production.up.railway.app/api/v1/auth/sso`

---

## 8. Flux SSO end-to-end

L'API Web et l'API LMS sont sur deux domaines Railway distincts (pas de cookie cross-domain possible). Le SSO repose sur un **ticket-exchange** : token interne ajouté en query string par l'API, intercepté côté Web par un middleware Next.js qui le pose en cookie HttpOnly et nettoie l'URL.

### Hops observés

| # | Acteur | Action |
|---|---|---|
| 1 | Apprenant | Clique "Accéder au module e-learning" depuis l'extranet Dendreo |
| 2 | Browser → API | `GET /api/v1/auth/sso?jwt=…&return_to=…&dendreo_return_to=…` |
| 3 | API LMS | Valide le JWT Dendreo (HS256, `iat<=5min`, `jti` non rejoué) → génère `internalJwt` → `302` vers `WEB_URL/formations/[id]?enrolment=[id]&token=<internalJwt>` |
| 4 | Browser | Suit la redirection vers le domaine Web |
| 5 | Middleware Next.js | Intercepte `?token=`, pose `Set-Cookie: token=…; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=8h` sur le domaine Web → `302` vers la même URL sans le param |
| 6 | Browser → Web → API | Charge la page, fetch `/api/v1/player/formations/[id]` (rewrite Next.js vers l'API), cookie embarqué via `credentials: 'include'`, validé par le middleware API → `200` |

### Rôle du middleware Next.js ([apps/web/src/middleware.ts](../apps/web/src/middleware.ts))

- Capture `?token=` sur **n'importe quelle page applicative** (matcher large, exclut `/api`, `/_next/*`)
- Pose le cookie HttpOnly côté Web (immune à l'exfiltration XSS)
- Nettoie l'URL (le token disparaît de la barre d'adresse, du `Referer`, des logs Next)
- La page de relais `/sso/dendreo` reste fonctionnelle en fallback (chemin sans `return_to`, écrit en `localStorage` + Bearer header)

### Note sur SameSite=Lax

Le cookie est posé avec `SameSite=Lax`, ce qui fonctionne dans notre architecture **uniquement grâce à la rewrite Next.js** (`next.config.ts` rewrite `/api/v1/*` → `NEXT_PUBLIC_API_URL/api/v1/*`). Du point de vue du navigateur, les requêtes du Web vers l'API apparaissent comme **same-origin** et le cookie est donc bien envoyé.

Sans cette rewrite (par exemple si le frontend appelait directement l'URL Railway de l'API), il aurait fallu passer le cookie en `SameSite=None; Secure` pour autoriser le cross-site, avec les implications CSRF associées.

À garder en tête si l'architecture évolue (ex : déploiement séparé du frontend ou suppression de la rewrite).

---

## Phase 2A — Refonte multi-rôles (⛔ DÉPRÉCIÉE — REVERTÉE LE 07/05/2026)

> ⛔ **DÉPRÉCIÉ** — section conservée à titre de **traçabilité historique**.
> Le tag `v0.2-phase2a-final` marque l'état du repo à la fin de cette phase, juste avant le revert.
> Le modèle finalement retenu est documenté dans **Phase 2A bis** ci-dessous.

### Contexte initial

Besoin remonté pendant la Phase 1 : permettre à un user (typiquement un admin) de cumuler plusieurs rôles simultanément (ex : admin + trainer + learner pour des tests internes).

### Travail réalisé (4 commits sur `main`)

| Commit | Sujet |
| --- | --- |
| `c918a70` | feat(auth): support multi-roles per user (UserRole[]) |
| `3d75e3c` | fix(admin): allow admin/superadmin on admin sub-routers after multi-roles refactor |
| `3bdfb94` | fix(admin): allow superadmin on admin-only routers (admin, users, exports, reminders, formations) |
| `cd30414` | fix(admin): multi-roles UI for users (table badges + form multi-select) |

Schéma : `User.role: UserRole` → `User.roles: UserRole[]` (Postgres array natif), backfill non-destructif via migration `20260506120000_user_roles_multi`. Hiérarchie linéaire supprimée — chaque check de rôle liste explicitement les rôles autorisés. Payload JWT passe de `{ role }` à `{ roles }`. UI admin/utilisateurs migrée vers un multi-select à tags (composant `RoleTagSelect`).

### Pourquoi le revert

Après mise en place, on a constaté que le multi-rôles ne reflète pas le besoin réel d'Artist Academy :

- Un admin n'a jamais besoin d'être *à la fois* admin et trainer staff. C'est **l'assignation à une formation** qui doit ouvrir l'espace formateur, pas un rôle global.
- Le besoin "tester en apprenant" se résout via le SSO Dendreo (extranet) côté apprenant, sans toucher au modèle staff.
- Le multi-rôles introduit de la complexité côté code (élargissement explicite des guards `requireRole`) et côté UI (multi-select à tags) sans bénéfice métier clair.

Le bon modèle est documenté dans **Phase 2A bis** ci-dessous.

---

## Phase 2A bis — Modèle final mono-rôle + assignation formation

> 📌 **Décidé le 07/05/2026** — annule et remplace Phase 2A.

### Modèle

1. **Mono-rôle** — `User.role: UserRole` (admin OU trainer OU learner, exclusif). Retour au schéma pré-Phase 2A.
2. **L'accès à `/formateur/*` ne dépend PAS du rôle** — il dépend d'une **assignation** user ↔ formation : champ `Formation.trainerId` (1 seul formateur principal par formation, déjà présent en DB depuis la migration `20260411071403_add_trainer_to_formation`).
3. Un **admin assigné comme formateur** d'une formation accède à `/formateur/*` pour cette formation, **tout en gardant** ses droits admin sur `/admin/*`.
4. Le besoin "apprenant test" passe par le SSO Dendreo (extranet), comme n'importe quel apprenant. Aucun changement côté modèle staff : pas de rôle `'learner'` explicite à poser sur un compte staff, l'apprenant est juste inscrit via Dendreo.
5. **Post-login pour un admin** :
   - Si assigné à ≥ 1 formation : écran de switch « Espace Admin / Mes formations »
   - Sinon : redirection directe vers `/admin`

### Chantiers d'implémentation à venir

| # | Chantier | Description |
| --- | --- | --- |
| a | **Revert technique du multi-rôles** | Restauration de `User.role: UserRole`, suppression de `User.roles[]`, rollback du payload JWT (`{ role }`), retrait du multi-select UI (`RoleTagSelect` + `EditRolesSlideOver`), restauration du dropdown mono-rôle. Migration non-destructive en miroir : ADD COLUMN `role` → backfill `role = roles[0]` → DROP COLUMN `roles`. Rotation `JWT_SECRET` post-deploy pour invalider les sessions multi-rôles encore actives. |
| b | **Champ Formateur sur la formation** | `Formation.trainerId` existe déjà ; vérifier que l'UI admin de gestion des formations expose un sélecteur formateur clair (peuplé via `GET /admin/trainers`, qui filtre sur `roles.has('trainer')` aujourd'hui — à adapter au mono-rôle après revert). Documenter la sémantique « 1 formateur principal par formation ». |
| c | **Logique d'accès `/formateur/*` + écran post-login switch** | Le guard `requireRole('trainer')` sur `formateurRouter` doit être remplacé par un check « le user a au moins une formation assignée » (lookup `Formation.trainerId === user.userId`). Écran post-login pour les admins assignés (switch Admin / Mes formations) ; les admins non-assignés vont directement à `/admin`. |

---

## Phase 2B — Refonte du handler `user.created` (✅ DÉPLOYÉE EN PROD 08/05/2026)

> 📌 **Bug c résolu** — commit `5fcdf27`, tag `v0.6-dendreo-user-matching`. Bloqueur prod levé.

### Contexte

Avant Phase 2B, `handleUserWebhook` faisait un `prisma.user.upsert({ where: { email } })` qui matchait uniquement par email. Conséquence : un participant Dendreo partageant son email avec un user LMS existant (typiquement un admin) écrasait son profil avec les champs Dendreo (`fullName`, `externalId`, `dendreoUserId`, `tmsOrigin`). Pollution constatée sur le compte `eva.randrianasolo@gmail.com` lors de la validation sandbox (cf. cleanup ci-dessous).

### Stratégie de matching `user.created` (Stratégie C)

Le handler webhook `user.created` suit cet ordre strict :

1. **Match par `dendreoUserId`** (= `external_id` du payload Dendreo)
   - Si trouvé : update `fullName`, `externalId`, `tmsOrigin`, `isActive`
   - **Ne touche jamais à `role` ni `passwordHash`**, même si le payload contient un `password`

2. **Sinon, match par email**
   - **2a.** Si user trouvé **sans** `dendreoUserId` existant
     → rattachement (lui assigne le `dendreoUserId` + `externalId` du payload)
   - **2b.** Si user trouvé **avec** un `dendreoUserId` **DIFFÉRENT** du payload
     → **COLLISION détectée**
     → user existant **N'EST PAS modifié**
     → création d'un nouveau user avec :
       - `email = dendreo-{external_id}@no-email.local` (placeholder ; suffixe `.local` réservé RFC 6762, non routable)
       - `dendreoUserId = external_id`
       - `externalId = external_id`
       - `role = learner`
       - `isActive = true`
       - `passwordHash = null`
     → `EventLog` `category=webhook`, `action=dendreo.collision` avec payload `{originalEmail, existingUserId, existingDendreoUserId, newUserId, newDendreoUserId, timestamp}`

3. **Aucun match** → création normale (avec l'email du payload)

`passwordHash` n'est plus jamais écrit par ce handler — l'authentification se fait via SSO Dendreo, pas par mot de passe local.

Implémentation : fonction privée `matchOrCreateUser()` dans [apps/api/src/modules/dendreo/dendreo.webhooks.service.ts](../apps/api/src/modules/dendreo/dendreo.webhooks.service.ts) qui retourne `{ user, action, collision? }`. Couverture tests : [apps/api/tests/dendreo.user-webhook.test.ts](../apps/api/tests/dendreo.user-webhook.test.ts) — 9 cas (4 branches de la stratégie + régression admin `role`/`passwordHash` jamais touchés sur match + couverture bug e préservée).

### Tests prod validés (3 scénarios curl)

1. **Création** — `user.created` avec un nouvel `external_id` → user créé, `dendreoUserId` ET `externalId` remplis.
2. **Re-match `dendreoUserId`** — second `user.created` avec le même `external_id` mais un email modifié → user existant mis à jour, pas de doublon, pas de pollution sur d'autres comptes.
3. **Collision sur email partagé** — `user.created` avec un `external_id` neuf et un email déjà utilisé par un user à `dendreoUserId` différent → user existant intact, nouveau user créé avec email placeholder, `EventLog dendreo.collision` écrit.

### Cleanup compte admin pollué `eva.randrianasolo@gmail.com` (08/05/2026)

Le compte admin LMS de l'utilisatrice Eva avait été pollué par le bug c **avant** son fix : Dendreo avait envoyé un `user.created` pour le participant `2252` (email partagé), et le handler avait écrasé le profil admin avec `dendreoUserId=2252`, `externalId=2252`, `tmsOrigin=dendreo`.

Cleanup manuel effectué via SQL Supabase **après** déploiement de la Phase 2B :

1. **Dépollution de l'admin** :

   ```sql
   UPDATE users
   SET dendreo_user_id = NULL, external_id = NULL, tms_origin = NULL
   WHERE email = 'eva.randrianasolo@gmail.com';
   ```

2. **Création d'un nouveau user apprenant Eva avec email placeholder** :

   ```sql
   INSERT INTO users (..., email, dendreo_user_id, external_id, tms_origin, role, is_active, ...)
   VALUES (..., 'dendreo-2252@no-email.local', '2252', '2252', 'dendreo', 'learner', true, ...);
   ```

3. **Migration de l'enrollment** (`dendreo_enrolment_id 21519`) du compte admin vers le nouveau user apprenant.

4. **Suppression des users factices** créés pendant les tests prod (`99001` et `99002`).

**État final** : admin dépollué + nouveau user apprenant Eva séparé + enrollment migré. La cohérence avec Dendreo est préservée (même `enrolment_id` côté Dendreo et LMS).

**Risque résiduel : aucun.** Le prochain SSO de Eva 2252 depuis Dendreo matchera par `dendreoUserId` sur le user apprenant placeholder, pas sur l'admin.

---

## 9. Bugs résiduels à traiter avant la prod

| # | Sévérité | Bug | Notes |
| --- | --- | --- | --- |
| ~~a~~ | ~~Sécurité~~ | ~~Endpoints webhooks renvoient `500` au lieu de `401` quand la signature HMAC est invalide~~ | ✅ **FIXED** `544f1a4` — guard de longueur ajouté avant `timingSafeEqual` (HMAC + API key), warn log structuré sur rejet |
| b | Race | Si `enrolment.created` arrive avant `session.created`, l'enrollment est créé sans `dendreo_session_id` | Observé sur l'enrolment EVA TEST `id 21519` — prévoir un backfill ou file d'attente |
| ~~c~~ | ~~🚨 BLOQUEUR PROD~~ | ~~`user.created` faisait un upsert sur l'`email`, ce qui polluait un user LMS partageant l'email avec un participant Dendreo~~ | ✅ **FIXED** `5fcdf27` (tag `v0.6-dendreo-user-matching`, déployé 08/05/2026) — Stratégie C : match `dendreoUserId` first, fallback email avec garde-fou collision (création séparée + `EventLog dendreo.collision`). `passwordHash`/`role` jamais touchés sur match. Cf. *Phase 2B* ci-dessus pour la spec complète + cleanup compte admin Eva. |
| d | Observabilité | Logging insuffisant des webhooks `user.created` et `enrolment.created` | Seul `session.created` produit un log structuré clair |
| ~~e~~ | ~~Données~~ | ~~`users.dendreo_user_id` reste NULL alors qu'elle devrait être renseignée~~ | ✅ **FIXED** `c8e83fc` (option A — sync `dendreoUserId` ← `externalId` au webhook) + `8f104bd` (script de backfill `backfill-dendreo-user-id.ts` pour les rows existantes) |
| ~~f~~ | ~~Feature~~ | ~~Bouton "Retour à Dendreo" non implémenté dans l'UI LMS~~ | ✅ **FIXED** — déjà implémenté dans [apps/web/src/app/formations/[id]/page.tsx](../apps/web/src/app/formations/[id]/page.tsx) (composant `DendreoReturnLink`, lit le cookie `dendreo_return_to` posé par l'API SSO, fallback `NEXT_PUBLIC_DENDREO_EXTRANET_URL`). Découvert pendant l'audit Phase 1. |

---

## 10. Actions ouvertes

- [ ] **REVERT PHASE 2A** : retour au mono-rôle (`User.role: UserRole`) + implémentation du champ Formateur sur formation (`Formation.trainerId`, déjà en DB) + écran post-login switch « Espace Admin / Mes formations » pour les admins assignés à au moins une formation. Cf. *Phase 2A bis* ci-dessus pour les 3 chantiers détaillés.
- [x] ~~Marina : activer le Connecteur LMS Universel sur la sandbox~~ ✅ 06/05/2026
- [x] ~~Configurer le formulaire connecteur avec les valeurs de §7~~ ✅
- [x] ~~Tester le flow complet : participant sandbox → ADF → SSO depuis l'extranet → page formation~~ ✅
- [x] ~~**Traiter le bloqueur prod (§9 bug c) — impératif avant tout go-live**~~ ✅ 08/05/2026 — Phase 2B, commit `5fcdf27`, tag `v0.6-dendreo-user-matching`. Cleanup compte admin Eva effectué via SQL Supabase.
- [ ] **Investiguer la cause du vidage des tables Supabase 7-8 mai 2026** — cause inconnue, hypothèse : startup script Railway ou commande Prisma destructive lors d'un déploiement. À élucider avant le go-live prod.
- [ ] Implémenter le pull `extranet_autologin_url` au moment des relances email *(infra existante, à brancher sur le scheduler)*
- [ ] Traiter les bugs résiduels restants en §9 (b, d) — (a, c, e, f shippés)
- [ ] **Tester l'intégration sur la prod Dendreo** (avec un Participant + Module + ADF clairement marqués TEST), avant la bascule réelle des apprenants existants
- [ ] Documenter la procédure de bascule sandbox → prod le jour du go-live
- [ ] Renommer `tenant_id` `taa-formation-test` → valeur prod

---

## 11. Liens utiles

- Doc Connecteur LMS Universel : `/mnt/project/Dendreo__Connecteur_LMS_universel.pdf`
- Doc API Dendreo : https://developers.dendreo.com/
- Admin sandbox : https://pro.dendreo.com/the_artist_academy_sandbox
- LMS API : <https://artist-academyapi-production.up.railway.app>
- LMS Web : <https://artist-academyweb-production.up.railway.app>
- Commits clés :
  - `197bc99` `fix(dendreo): cast external_id to string before Prisma upsert`
  - `2db0c6a` `chore: bump Node engine to >=22 for @supabase/realtime-js compat`
  - `ad3ef32` `fix(sso): forward internal token via query string when return_to is set`
  - `5fcdf27` `fix(dendreo): refactor user.created handler to match by dendreoUserId first, then email with collision guard` *(Phase 2B, tag `v0.6-dendreo-user-matching`)*
