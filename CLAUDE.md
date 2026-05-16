# CLAUDE.md — The Artist Academy LMS

> LMS custom sur mesure pour The Artist Academy.
> Remplace Dokeos. Dendreo reste l'unique porte d'entrée administrative et apprenant.
> Dernière mise à jour : 16/05/2026

---

## 🏗️ Stack technique

- **Monorepo** : `apps/web` (Next.js) + `apps/api` (API REST)
- **Frontend** : Next.js (App Router) — `apps/web/`
- **Backend** : API REST — `apps/api/`
- **Base de données** : Supabase + Prisma ORM
- **Auth** : JWT interne (SSO Dendreo via ticket-exchange)
- **Hébergement** : Railway — 2 services séparés
  - Web : `https://artist-academyweb-production.up.railway.app`
  - API : `https://artist-academyapi-production.up.railway.app`
- **Intégration tierce** : Dendreo (Connecteur LMS Universel — JWT SSO + Webhooks)

---

## 🔒 Fichiers INTOUCHABLES

> Ne jamais modifier sans instruction explicite et confirmation. Ces fichiers touchent à la sécurité ou à des mécanismes validés en prod.

```
apps/web/src/middleware.ts         ← SSO ticket-exchange (cookie HttpOnly) — CRITIQUE
apps/web/next.config.ts            ← Rewrite /api/v1/* → API ; SameSite=Lax en dépend
prisma/schema.prisma               ← Schéma DB — migration = coordonner explicitement
.env / .env.local                  ← Variables d'environnement
apps/api/src/lib/auth.ts           ← Validation JWT interne
```

---

## 🔐 Règle critique : séparation des secrets Railway

> ⚠️ Cette règle est **absolue** — une violation = fuite de secret en prod.

| Variable | Service Railway autorisé |
|---|---|
| `DENDREO_API_KEY` | **API uniquement** |
| `DENDREO_SIGNATURE_KEY` | **API uniquement** |
| `JWT_SECRET` | **API uniquement** |
| `NEXT_PUBLIC_*` | Web uniquement |
| `DATABASE_URL` | API uniquement |

**Ne jamais exposer `DENDREO_API_KEY`, `DENDREO_SIGNATURE_KEY` ou `JWT_SECRET` sur le service Web.**

---

## 📐 Règles d'architecture

### Modèle de rôles — MONO-RÔLE (post-revert Phase 2A)

> ✅ **Revert Phase 2A livré (08/05/2026).** Le modèle en place est `User.role: UserRole` — enum exclusif `admin | trainer | learner`.
> Ne PAS réintroduire `User.roles[]` ni le composant `RoleTagSelect`.

- Un user a **un seul rôle** à la fois
- L'accès à `/formateur/*` dépend de `Formation.trainerId === user.userId`, **pas du rôle**
- Un admin assigné à une formation accède à `/formateur/*` pour cette formation uniquement
- Le rôle `learner` n'existe PAS pour les comptes staff — l'accès apprenant se fait via SSO Dendreo

### SSO — ticket-exchange

- L'API génère un `internalJwt` et redirige vers `WEB_URL/...?token=<internalJwt>`
- Le middleware Next.js (`apps/web/src/middleware.ts`) intercepte `?token=`, pose un cookie HttpOnly, nettoie l'URL
- Le frontend appelle l'API via les rewrites Next.js — le cookie est envoyé automatiquement (same-origin côté navigateur)
- **Ne jamais bypasser ce flow** — ne pas stocker le token dans `localStorage` sauf fallback `/sso/dendreo`

### Webhooks Dendreo

- Les 3 endpoints webhooks (`/users`, `/enrolments`, `/sessions`) vérifient la signature HMAC avec `DENDREO_SIGNATURE_KEY`
- La vérification utilise `timingSafeEqual` + guard de longueur — **ne jamais simplifier cette vérification**
- Ordre d'arrivée non garanti : `enrolment.created` peut arriver avant `session.created` (bug b connu)

### Hiérarchie pédagogique

```
Formation → Module(s) → UA (1 vidéo OU 1 quiz OU 1 ressource)
```

- Complétion vidéo : seuil paramétrable (défaut 99%)
- Quiz : non bloquant, tentatives illimitées
- Ressource : terminée à l'ouverture
- Mode parcours : linéaire (module N+1 verrouillé si N non terminé) ou non linéaire — paramétrable par formation

---

## ⚠️ Chantiers en cours — NE PAS interférer

> Liste détaillée + statuts à jour : voir [Documentation/DENDREO_INTEGRATION_NOTES.md §9](Documentation/DENDREO_INTEGRATION_NOTES.md).

### 🚨 BLOQUEURS PROD — Cache Dendreo (bugs g/h/i, découverts 12/05/2026)

Dendreo maintient un cache `participant_id ↔ user_id_lms` qui n'est pas invalidable depuis le LMS. Toute donnée pourrie injectée pré-Phase 2B y reste, et nos handlers font confiance aveuglément au `user_id` reçu.

- **g** : `handleEnrolmentWebhook` accepte n'importe quel `user_id` du payload → enrollment créé sur un admin pollué historiquement
- **h** : SSO Dendreo accepte n'importe quel `user_id` du JWT → **faille d'élévation de privilèges** (un apprenant se connecte avec un user_id admin en cache)
- **i** : pas d'API exposée par Dendreo pour reset le mapping côté participant → à clarifier avec Marina

Solution durable (analogue à la Stratégie C de Phase 2B) : refuser enrolment + SSO si le `user_id` cible pointe sur un user `admin | superadmin`, fallback de récupération du bon learner par autre voie.

### 🟡 Bugs résiduels connus

| Bug | Description |
|---|---|
| b (Race) | `enrolment.created` peut arriver avant `session.created` → enrollment sans `dendreo_session_id` |
| d (Observabilité) | Logging insuffisant sur `user.created` et `enrolment.created` |

### 📜 Historique récent (résolus)

- **Phase 2A bis (revert mono-rôle)** — livré 08/05/2026. `User.role: UserRole` restauré, `RoleTagSelect` retiré, JWT payload `{ role }`. Cf. règle "MONO-RÔLE" ci-dessus.
- **Bug c (upsert `user.created` polluait les admins par collision email)** — fixé Phase 2B (commit `5fcdf27`, tag `v0.6-dendreo-user-matching`, déployé 08/05/2026). Stratégie C en place : matching `dendreoUserId`-first, fallback email avec collision guard. **Ne pas régresser cette stratégie.**

---

## ✅ Checklist avant de terminer une tâche

1. Aucun fichier hors périmètre modifié
2. Aucune variable secrète ajoutée sur le service Web
3. Aucune régression sur le flow SSO (middleware + cookie HttpOnly)
4. Le schéma Prisma n'a pas changé sans migration explicite
5. `npm run build` (ou équivalent monorepo) — corriger toute erreur avant de terminer
6. Résumer les fichiers modifiés avec une ligne d'explication par fichier

---

## 🔁 Git

- Faire un commit AVANT de commencer une nouvelle tâche
- Format : `type(scope): description` — ex: `fix(sso): correct token expiry check`
- Scopes courants : `sso`, `auth`, `dendreo`, `player`, `admin`, `formateur`, `quiz`, `video`, `email`, `db`
- Quand je demande un checkpoint : `git add -A && git commit -m "[message]"`

---

## 🚫 Comportements interdits

- Ne jamais réintroduire `User.roles[]` ou le multi-rôles (Phase 2A dépréciée)
- Ne jamais exposer `DENDREO_API_KEY` / `DENDREO_SIGNATURE_KEY` / `JWT_SECRET` sur le service Web
- Ne jamais modifier `apps/web/src/middleware.ts` ou `next.config.ts` sans instruction explicite
- Ne jamais simplifier la vérification HMAC des webhooks Dendreo
- Ne jamais bypasser la Stratégie C de matching dans `user.created` (dendreoUserId-first → fallback email avec collision guard → création séparée si collision) — cf. Phase 2B
- Ne jamais supprimer de code existant sans confirmation
- Ne jamais refactoriser ce qui n'a pas été demandé

---

## 📁 Routes clés

| Route | Service | Description |
|---|---|---|
| `POST /api/v1/dendreo/users` | API | Webhook `user.created` |
| `POST /api/v1/dendreo/enrolments` | API | Webhook `enrolment.created` |
| `POST /api/v1/dendreo/sessions` | API | Webhook `session.created` |
| `GET /api/v1/dendreo/trainings` | API | Pull catalogue formations par Dendreo |
| `GET /api/v1/auth/sso` | API | Validation JWT Dendreo → ticket interne |
| `GET /api/v1/player/formations/[id]` | API | Données formation apprenant (via rewrite) |
| `/formations/[id]` | Web | Page formation apprenant (landing SSO) |
| `/admin/*` | Web | Back-office admin |
| `/formateur/*` | Web | Espace formateur (accès via trainerId) |
| `/sso/dendreo` | Web | Fallback SSO (sans `return_to`) |

---

## 💬 Format de réponse attendu

À la fin de chaque tâche :

```
✅ Tâche terminée
📁 Fichiers modifiés :
  - chemin/fichier.ts → [ce qui a changé]
⚠️ Points d'attention : [si applicable]
🔨 Build : OK / ERREUR [détail]
```
