# Intégration Dendreo — Notes de tests

> Document de référence pour l'intégration avec le Connecteur LMS Universel Dendreo.
> Dernière mise à jour : 06/05/2026 — **intégration validée end-to-end sur sandbox**.

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

## 9. Bugs résiduels à traiter avant la prod

| # | Sévérité | Bug | Notes |
| --- | --- | --- | --- |
| a | Sécurité | Endpoints webhooks renvoient `500` au lieu de `401` quand la signature HMAC est invalide | Sécurité par obscurité non respectée — fuite d'info sur l'existence du endpoint |
| b | Race | Si `enrolment.created` arrive avant `session.created`, l'enrollment est créé sans `dendreo_session_id` | Observé sur l'enrolment EVA TEST `id 21519` — prévoir un backfill ou file d'attente |
| **c** | **🚨 BLOQUEUR PROD** | **`user.created` fait un upsert sur l'`email`. Un admin Dendreo partageant son email avec un participant verrait son rôle écrasé en `learner`** | **À refondre IMPÉRATIVEMENT avant prod : matcher d'abord sur `dendreo_user_id`, ne jamais downgrade un rôle existant. N'importe quelle inscription Dendreo avec un email d'admin LMS = compromission du compte admin.** |
| d | Observabilité | Logging insuffisant des webhooks `user.created` et `enrolment.created` | Seul `session.created` produit un log structuré clair |
| e | Données | `users.dendreo_user_id` reste NULL alors qu'elle devrait être renseignée | Fix dans le handler `user.created` |
| f | Feature | Bouton "Retour à Dendreo" non implémenté dans l'UI LMS | Utiliser `dendreo_return_to` (cf. doc PDF Connecteur LMS Universel p.18) — cookie `dendreo_return_to` déjà posé par l'API SSO |

---

## 10. Actions ouvertes

- [x] ~~Marina : activer le Connecteur LMS Universel sur la sandbox~~ ✅ 06/05/2026
- [x] ~~Configurer le formulaire connecteur avec les valeurs de §7~~ ✅
- [x] ~~Tester le flow complet : participant sandbox → ADF → SSO depuis l'extranet → page formation~~ ✅
- [ ] **Traiter le bloqueur prod (§9 bug c) — impératif avant tout go-live**
- [ ] Implémenter le pull `extranet_autologin_url` au moment des relances email *(infra existante, à brancher sur le scheduler)*
- [ ] Traiter les autres bugs résiduels listés en §9 (a, b, d, e, f)
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
