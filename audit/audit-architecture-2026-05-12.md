# Audit Architecture & Scalabilité — The Artist Academy LMS

> Date : 2026-05-12
> Cible volumétrie : 200 apprenants/mois, 50 sessions simultanées max (PRD V1.3)
> Objectif : identifier bugs latents, points faibles et risques à cette échelle — pas d'optimisation prématurée pour millions d'utilisateurs.
> Méthode : 5 axes (DB, API, Frontend, Infra, Sécu), chaque finding cite `fichier:ligne`.

---

## 📊 Tableau récapitulatif des verdicts

| Axe | Verdict | Risques P0 | Risques P1 |
|---|---|---|---|
| **1. Base de données** | 🟡 | 3 | 4 |
| **2. API** | 🟡 | 1 | 3 |
| **3. Frontend** | 🟡 | 0 | 3 |
| **4. Infrastructure** | 🟡 | 3 | 3 |
| **5. Sécurité** | 🟡 | 1 | 3 |
| **Global** | 🟡 | **8** | **16** |

**Go-live 200 apprenants possible ?** Non en l'état — 4 bloqueurs RGPD/Infra/OOM à lever (cf §Risques bloquants).

---

## Axe 1 — Base de données (Supabase Postgres + Prisma)

**Verdict** : 🟡 Schéma sain, mais requêtes non paginées et includes profonds sur exports/admin = OOM probable à volumétrie cible.

### Points forts
- 22 modèles Prisma cohérents, 26 `@@index` définis, relations CASCADE propres
- Pooler Supabase configuré : `pgbouncer=true&port=6543` + `DIRECT_URL` séparé pour migrations ([apps/api/.env.example:3-5](apps/api/.env.example#L3-L5))
- Client Prisma singleton global ([apps/api/src/config/database.ts:3-15](apps/api/src/config/database.ts#L3-L15))
- Revert mono-rôle propre ([migration 20260507120000_revert_user_roles_multi](apps/api/prisma/migrations/20260507120000_revert_user_roles_multi/migration.sql))

### Risques

- **[P0] Exports sans pagination, includes 4 niveaux** — [apps/api/src/modules/exports/exports.service.ts:36](apps/api/src/modules/exports/exports.service.ts#L36), [:102](apps/api/src/modules/exports/exports.service.ts#L102), [:212](apps/api/src/modules/exports/exports.service.ts#L212), [:311](apps/api/src/modules/exports/exports.service.ts#L311), [:388](apps/api/src/modules/exports/exports.service.ts#L388) — `findMany` sans `take/skip` + include `Enrollment → Formation → Module → UA → VideoContent`. À 2400 enrollments × 2500 UAs, c'est 6M lignes en RAM.
- **[P0] Dashboard admin charge tous les enrollments en mémoire** — [apps/api/src/modules/admin/admin.service.ts:22-24](apps/api/src/modules/admin/admin.service.ts#L22-L24) — 5 KPIs calculés via `prisma.enrollment.findMany({ include: { uaProgresses: true } })` sans limite.
- **[P0] `exportProgressionDetaillee` ~100+ queries par appel** — [exports.service.ts:384-493](apps/api/src/modules/exports/exports.service.ts#L384-L493) — includes profonds + traitement client-side.
- **[P1] Index manquants** :
  - `(category, created_at DESC)` sur EventLog
  - `(enrollmentId, status)` sur UAProgress
  - `(userId, sentAt DESC)` sur ReminderLog
  - `(selectedChoiceId)` sur QuizAnswer
  - `(formationId, status)` sur Enrollment
- **[P1] N+1 dans webhooks Dendreo** — [dendreo.webhooks.service.ts:346-391](apps/api/src/modules/dendreo/dendreo.webhooks.service.ts#L346-L391) — fallback `findFirst` séquentiels pour matching.
- **[P2] Colonnes nullable suspectes** — `FormationProgress.firstAccessedAt/lastActivityAt/webhookLastSyncedAt` ([schema.prisma:363-365](apps/api/prisma/schema.prisma#L363-L365)) — sémantique floue.

### Volumétrie projetée

| Table | Croissance estimée | Risque 12 mois | Action |
|---|---|---|---|
| **EventLog** | ~500k lignes/mois | 6M lignes/an → scans lents | Index composite + archivage |
| **ReminderLog** | jusqu'à 500k/mois (pire cas relances quotidiennes) | Idem | Index `userId`, partitioning |
| **UAProgress** | ~50k lignes/mois | Faible | Index `(enrollmentId, status)` |
| **QuizAttempt** | ~100k/mois | Acceptable 2-3 ans | Surveiller |
| **User** | ~200/mois | Négligeable | — |

---

## Axe 2 — API (Express + TypeScript + Prisma)

**Verdict** : 🟡 Structurellement OK pour 50 sessions, mais 4 P1 à fermer avant scaling.

### Points forts
- Helmet + CORS configurés ([apps/api/src/index.ts:44-45](apps/api/src/index.ts#L44-L45))
- JWT HS256, cookie HttpOnly, expiry 8h ([apps/api/src/modules/auth/login.controller.ts:66-70](apps/api/src/modules/auth/login.controller.ts#L66-L70))
- HMAC webhooks Dendreo : `timingSafeEqual` + guard longueur ([apps/api/src/modules/dendreo/dendreo.middleware.ts:32-46](apps/api/src/modules/dendreo/dendreo.middleware.ts#L32-L46))
- Rate limiters ciblés : SSO, login, progress heartbeat, email test ([apps/api/src/middleware/rateLimiter.ts](apps/api/src/middleware/rateLimiter.ts))

### Risques

- **[P0] Exports CSV chargés intégralement en RAM** — [exports.service.ts:94](apps/api/src/modules/exports/exports.service.ts#L94) — `stringify(rows, { header: true, bom: true })` puis `res.send`. À 10k lignes = ~50-100 MB par export. Railway 512 MB + 2 exports parallèles = OOM garanti.
- **[P1] Webhooks Dendreo non idempotents** — [dendreo.webhooks.service.ts:360-410](apps/api/src/modules/dendreo/dendreo.webhooks.service.ts#L360-L410) — `alreadyExisted=true` ligne 422-434 renvoie quand même une progression → doublons.
- **[P1] Pas de rate limiting sur exports** — [exports.router.ts:36-89](apps/api/src/modules/exports/exports.router.ts#L36-L89) — un admin peut lancer 100 exports parallèles → DoS interne.
- **[P1] Validation Zod ~20%** — exports, resources, formations sans schema. Exemple : [exports.router.ts:78-79](apps/api/src/modules/exports/exports.router.ts#L78-L79) `?formationId=` non validé.
- **[P2] Multer `memoryStorage`** — uploads vidéos 500 MB ([videos.router.ts:9](apps/api/src/modules/videos/videos.router.ts#L9)) et ressources 50 MB ([resources.router.ts:15-17](apps/api/src/modules/resources/resources.router.ts#L15-L17)) en RAM.
- **[P2] Pas de readiness probe** — `/health` répond sans tester DB ([apps/api/src/health.ts:11-16](apps/api/src/health.ts#L11-L16)).
- **[P2] PII dans event logs** — emails en clair ([exports.service.ts:193-203](apps/api/src/modules/exports/exports.service.ts#L193-L203), [dendreo.webhooks.service.ts:204-208](apps/api/src/modules/dendreo/dendreo.webhooks.service.ts#L204-L208)).
- **[P2] Sentry installé mais non initialisé** — `@sentry/node` en deps, `SENTRY_DSN` absent de `.env.example`.

### Top 5 routes lourdes

1. `GET /api/v1/admin/exports/progression-detaillee` — ~100+ queries — [exports.service.ts:384](apps/api/src/modules/exports/exports.service.ts#L384)
2. `GET /api/v1/admin/dashboard` — 50-200 queries — [admin.service.ts:18-116](apps/api/src/modules/admin/admin.service.ts#L18-L116)
3. `GET /api/v1/admin/exports/apprenants` — 15-30 queries — [exports.service.ts:31-95](apps/api/src/modules/exports/exports.service.ts#L31-L95)
4. `GET /api/v1/player/formations/:id` — 8-12 queries × 50 sessions — [formations.player.service.ts:20-107](apps/api/src/modules/formations/formations.player.service.ts#L20-L107)
5. `POST /api/v1/dendreo/users|sessions|enrolments` — N×findFirst fallback — [dendreo.webhooks.service.ts](apps/api/src/modules/dendreo/dendreo.webhooks.service.ts)

---

## Axe 3 — Frontend (Next.js App Router)

**Verdict** : 🟡 Stable, mais waterfalls clients probables à 50 sessions sans cache lib.

### Points forts
- IntersectionObserver sticky sur ResourceViewer ([ResourceViewer.tsx:22-46](apps/web/src/components/.../ResourceViewer.tsx#L22-L46))
- Uploads contournent le proxy Next ([api.ts:86](apps/web/src/lib/api.ts#L86)) — gros fichiers OK
- ReactQuill lazy via `next/dynamic` ([relances/page.tsx:5-36](apps/web/src/app/admin/relances/page.tsx#L5-L36))
- Error boundary global ([error.tsx](apps/web/src/app/error.tsx))
- Pas de lodash/moment/pdf-lib (discipline bundle)

### Risques

- **[P1] Aucun React Query / SWR** — fetches manuels via `api.ts`, zéro dédup, invalidations à la main via `reload()` ([relances/page.tsx:165-172](apps/web/src/app/admin/relances/page.tsx#L165-L172)). À 50 sessions, doubles appels probables.
- **[P1] Tout en `'use client'`** — 25/27 pages CSR, aucune SSR/SSG. Pas de cache CDN, +JS côté client. Layouts admin/formateur en client (justifié par `usePathname`).
- **[P1] Upload progress absent** — [formateur/contenus/page.tsx:143-150](apps/web/src/app/formateur/contenus/page.tsx#L143-L150) : pas d'`onUploadProgress`. Avec bypass proxy commit `ceec92c`, l'utilisateur n'a aucun feedback sur upload 100 MB.
- **[P2] `<img>` natif partout** — 0 `next/image`. Logos OK, mais ressources non optimisées mobile/3G.
- **[P2] Pas de `loading.tsx` par segment** — UX bloquée pendant navigation.
- **[P2] Toast SetTimeout perd les notifs après `router.push`** — [ToastContext.tsx:36-40](apps/web/src/.../ToastContext.tsx#L36-L40), exemple : toast login success disparaît avant arrivée /admin.

### Bundle & cache
- Pas de monitoring du bundle taillé en prod (pas de `@next/bundle-analyzer`)
- `hls.js`, `@dnd-kit/*` chargés au top — vérifier qu'ils sont chunkés correctement
- Aucune stratégie `Cache-Control` consommée côté client

---

## Axe 4 — Infrastructure (Railway + Supabase + Resend)

**Verdict** : 🟡 Solide techniquement, mais 3 blockers prod : healthcheck web manquant, `.env.example` incomplet, plans tiers non confirmés.

### Points forts
- Healthcheck API monté avant middlewares ([health.ts:11](apps/api/src/health.ts#L11))
- Séparation secrets API/Web respectée (rien dans `apps/web/src/` ne lit `JWT_SECRET`/`DENDREO_*`)
- Node 22 + nixpacks alignés
- Signed URLs Supabase (TTL 2h) pour vidéos/ressources

### Risques

- **[P0] Pas de `/healthz` côté web** — Railway ne probe rien sur `apps/web/`. Crash silencieux possible.
- **[P0] Vars manquantes dans `.env.example`** — `DENDREO_API_BASE_URL`, `DENDREO_API_TIMEOUT_MS`, `DENDREO_LMS_NAME` utilisées dans [env.ts:21,48,49](apps/api/src/config/env.ts) mais non documentées. `DENDREO_REST_API_KEY` ([env.ts:44](apps/api/src/config/env.ts#L44)) orpheline.
- **[P0] Plan Supabase non confirmé** — Free (1 Go) < 50 Go projetés ; Pro ($25/mois, 100 Go) requis avant prod.
- **[P1] Pas de CDN devant les vidéos** — egress Supabase direct, latence apprenants France hétérogènes.
- **[P1] Backup Supabase non documenté** — restore procedure absente, RTO/RPO non définis (exigé PRD §2.2).
- **[P1] Resend plan indéterminé** — pire cas ~6000 emails/mois > 3000 du free ; Pro $20/mois requis.
- **[P2] Migrations Prisma non appliquées au boot** — pas de `npx prisma migrate deploy` en postbuild. Risque de drift schéma vs DB.

### Coût mensuel projeté

| Service | Plan | Coût |
|---|---|---|
| Supabase Pro (DB 8 Go + Storage 100 Go + 250k MAU) | Pro | $25 |
| Railway × 2 (Web + API, shared-cpu) | — | $10 |
| Resend Pro (50k emails/mois) | Pro | $20 |
| Bandwidth Supabase (180 Go egress estimé) | — | ~$15 |
| Sentry Free / Domain | — | ~$1 |
| **Total** | | **~$70-80/mois** |

Seuil de bascule : Supabase Team ($50+) au-delà de ~500 apprenants concurrents.

---

## Axe 5 — Sécurité

**Verdict** : 🟡 Solide sur l'auth/IDOR, mais RGPD non couvert (bloqueur).

### Points forts
- bcrypt salt rounds = 12 partout ([admin/users.service.ts:34](apps/api/src/modules/admin/users.service.ts#L34), [auth/password-reset.controller.ts:75](apps/api/src/modules/auth/password-reset.controller.ts#L75))
- Reset password : token 1h + single-use ([password-reset.controller.ts:37,81-82](apps/api/src/modules/auth/password-reset.controller.ts#L37))
- JWT Dendreo : algorithme HS256 strictement enforced + maxAge 300s + JTI replay protection ([auth.service.ts:94,105-110](apps/api/src/modules/auth/auth.service.ts#L94))
- IDOR : ownership checks systématiques (`requireFormationOwnership`, `requireUaOwnership`, `verifyLearnerAccess`)
- Rôle mono-rôle bien appliqué (pas de `roles[]` résiduel)
- Bug c (upsert `user.created`) **partiellement fixé** : matching `dendreoUserId` prioritaire, jamais downgrade de rôle ([dendreo.webhooks.service.ts:77-152](apps/api/src/modules/dendreo/dendreo.webhooks.service.ts#L77-L152))

### Risques

- **[P0] RGPD : aucun cron de purge IP/pays** — colonnes ajoutées par [migration 20260511090000](apps/api/prisma/migrations/20260511090000_add_ip_and_country_to_ua_progress/migration.sql), aucune politique de retention. PII persistantes indéfiniment.
- **[P1] RGPD : endpoints portabilité + oubli absents** — pas de `GET /api/v1/user/export-data`, pas de `DELETE /api/v1/user/me`. Non-conformité.
- **[P1] Bug c partiellement fixé** — collision crée un compte fantôme silencieux, pas d'alerte admin ([dendreo.webhooks.service.ts:181-208](apps/api/src/modules/dendreo/dendreo.webhooks.service.ts#L181-L208)).
- **[P1] Brute-force login non protégé** — [login.controller.ts:20-77](apps/api/src/modules/auth/login.controller.ts#L20-L77) — failed attempts non loggées, rate limiter manquant sur ce endpoint.
- **[P2] localStorage fallback SSO** — [sso/dendreo/page.tsx:35](apps/web/src/app/sso/dendreo/page.tsx#L35), [api.ts:25-32](apps/web/src/lib/api.ts#L25-L32) — toléré par CLAUDE.md, mais XSS-exploitable.
- **[P2] Email user en clair dans logs** — [dendreo.webhooks.service.ts:204-208](apps/api/src/modules/dendreo/dendreo.webhooks.service.ts#L204-L208).
- **[P2] Consentement cookies / politique de confidentialité** — page introuvable dans `apps/web/src/`.

---

## 🎯 Top 10 actions prioritaires (P0/P1)

| # | Action | Axe | Priorité | Effort | Impact |
|---|---|---|---|---|---|
| 1 | Streamer les exports CSV (csv-stringify transform) | API | P0 | S | Fort (évite OOM Railway) |
| 2 | Paginer/limiter les `findMany` admin & exports (dashboard, learners, progression-detaillee) | DB | P0 | M | Fort |
| 3 | Endpoints RGPD : export données perso + suppression compte | Sécu | P0/P1 | M | Bloqueur conformité |
| 4 | Cron purge IP/pays (>1 an) | Sécu | P0 | S | Bloqueur conformité |
| 5 | Healthcheck `/healthz` côté web Next.js | Infra | P0 | S | Fort |
| 6 | Compléter `.env.example` (DENDREO_API_BASE_URL, _TIMEOUT_MS, _LMS_NAME) ; supprimer DENDREO_REST_API_KEY orpheline | Infra | P0 | S | Fort |
| 7 | Confirmer plans Supabase Pro + Resend Pro + documenter restore | Infra | P0/P1 | S | Bloqueur prod |
| 8 | Idempotence webhooks Dendreo (clé `dendreoWebhookId` unique + check) | API | P1 | M | Fort (évite doublons) |
| 9 | Index DB : `(category, createdAt)` EventLog ; `(enrollmentId, status)` UAProgress ; `(userId)` ReminderLog | DB | P1 | S | Moyen |
| 10 | Rate limiter sur `/login` (brute force) + sur `/admin/exports/*` (DoS interne) | Sécu+API | P1 | S | Moyen |

---

## ⚡ Quick wins (<2h chacun, gros impact)

1. **Ajouter 3 index DB** (action #9) — 5 min de migration, gain mesurable sur exports
2. **Compléter `.env.example`** (action #6) — 10 min, évite crash prod
3. **Healthcheck web Next.js** (action #5) — créer `apps/web/src/app/healthz/route.ts` retournant 200
4. **Rate limiter `/login`** — réutiliser `apps/api/src/middleware/rateLimiter.ts`, 15 min
5. **Cron purge IP/pays** — un script `jobs/purge-pii.ts` + planification Railway

---

## 🚨 Risques bloquants AVANT mise en prod (200 apprenants)

Ces actions doivent être faites avant ouverture du LMS :

1. **RGPD** — Cron purge IP/pays + endpoints export/suppression (sans ça, exposition CNIL pour 200 apprenants)
2. **OOM exports** — Streamer CSV (sans ça, 1ʳᵉ export massif = redémarrage Railway en plein cours d'apprenant)
3. **Healthcheck web** — sans ça, downtime invisible
4. **`.env.example` incomplet** — risque de crash silencieux au boot prod
5. **Plans Supabase Pro + Resend Pro confirmés contractuellement** + procédure de restore documentée

Délai estimé : **5-8 jours-homme** pour fermer ces 5 bloqueurs.

---

## 🔭 Recommandations long terme (>3 mois)

- **Archivage EventLog** — partitioning par mois ou export S3 après 12 mois (table grossit ~6M lignes/an)
- **React Query / TanStack** côté web — déduplication + cache + invalidations propres
- **Observabilité prod** — Sentry initialisé (déjà installé) + readiness probe DB + metrics Prometheus
- **CDN devant Supabase Storage** — Cloudflare ou bunny.net pour HLS playlists (les segments restent signés)
- **Refactor `exportProgressionDetaillee`** — splitter en 2 requêtes plates au lieu de 4 niveaux d'`include`
- **CSP custom (web + API)** — Helmet defaults aujourd'hui, durcir
- **Audit secrets git history** — `gitleaks` ou `trufflehog` sur l'historique avant publication d'un repo
- **Multi-rôle/switch** — chantier Phase 2A bis CLAUDE.md, déjà identifié comme bloqueur prod

---

*Fin de l'audit. Aucun code produit, diagnostic uniquement. Prochaine étape : prioriser les actions et lancer les fixes par lots (commencer par les quick wins + bloqueurs RGPD).*
