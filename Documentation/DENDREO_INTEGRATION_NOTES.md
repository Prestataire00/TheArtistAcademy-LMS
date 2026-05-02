# Intégration Dendreo — Notes de tests

> Document de référence pour l'intégration avec le Connecteur LMS Universel Dendreo.
> Dernière mise à jour : 02/05/2026

---

## 1. Environnements

| Environnement | URL admin | Connecteur LMS Universel |
|---|---|---|
| Sandbox | `https://pro.dendreo.com/the_artist_academy_sandbox` | ❌ Non activé (en attente Marina) |
| Prod | (à compléter) | ✅ Activé |

**Extranet sandbox** : `https://extranet-the-artist-academy-sandbox.dendreo.com`

---

## 2. Authentification API Dendreo

| Méthode | Format | Statut |
|---|---|---|
| Query string | `?key=TA_CLE_API` | ✅ Validé sur sandbox |
| Header | `X-Auth-API-Key: TA_CLE_API` | À tester si besoin |

**Stockage local** : la clé API sandbox doit être ajoutée dans `.env` :
```env
DENDREO_API_KEY_SANDBOX=xxxxxxxx
DENDREO_BASE_URL_SANDBOX=https://pro.dendreo.com/the_artist_academy_sandbox/api
```

---

## 3. Endpoints validés (axe LMS → Dendreo)

### 3.1 Récupérer une entreprise

```bash
curl -s "https://pro.dendreo.com/the_artist_academy_sandbox/api/entreprises.php?key=KEY&id_entreprise=2223"
```

Renvoie un objet JSON avec `id_entreprise`, `raison_sociale`, `email_standard`, etc.

### 3.2 Lister les participants

```bash
curl -s "https://pro.dendreo.com/the_artist_academy_sandbox/api/participants.php?key=KEY"
```

### 3.3 Récupérer un participant

```bash
curl -s "https://pro.dendreo.com/the_artist_academy_sandbox/api/participants.php?key=KEY&id_participant=2252"
```

**Champs critiques de la réponse** :

| Champ | Description | Quand est-il rempli ? |
|---|---|---|
| `id_participant` | ID Dendreo du participant | Toujours |
| `email` | Email du participant | À la création |
| `extranet_url` | URL base de l'extranet | Toujours |
| `extranet_code` | Code unique d'autologin | **Après inscription à une ADF** |
| `extranet_autologin_url` | URL d'autologin direct vers l'extranet | **Après inscription à une ADF** |
| `lmsuniversel_user_id` | ID utilisateur côté LMS | Renseigné par le LMS via webhook user.created |

---

## 4. Comportement validé : `extranet_autologin_url`

**Découverte importante** : `extranet_autologin_url` est **vide tant que le participant n'est pas inscrit à une ADF**.

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

### Conséquence pour l'implémentation LMS

Pour les emails de relance (PRD §7.5) :

1. À chaque webhook Dendreo `enrolment.created`, le LMS doit appeler `GET /api/participants.php?id_participant=X` pour récupérer `extranet_autologin_url`
2. Stocker cette URL en base, attachée à l'enrollment
3. L'utiliser dans le template d'email de relance comme `{{lien_extranet}}`
4. Fallback si vide : utiliser `extranet_url` (l'apprenant devra saisir ses identifiants)

---

## 5. Données de test sandbox

Créées le 02/05/2026 pour les tests d'intégration :

| Type | ID | Nom |
|---|---|---|
| Particulier | `id_contact: 2218` | TEST EVA |
| Entreprise | `id_entreprise: 2223` | TEST EVA |
| Participant | `id_participant: 2252` | TEST EVA |
| Module e-learning | `id_module: à compléter` | Test LMS - Module e-learning |
| ADF | `id_action_de_formation: à compléter` | Test LMS - ADF |

---

## 6. Ce qui reste à tester (axe Dendreo → LMS)

⏸️ **Bloqué tant que le Connecteur LMS Universel n'est pas activé sur la sandbox.**

À tester dès qu'il sera activé :

| Test | Endpoint LMS | Validation attendue |
|---|---|---|
| Webhook `user.created` | `POST /api/v1/dendreo/users` | Création user en DB Supabase |
| Webhook `enrolment.created` | `POST /api/v1/dendreo/enrolments` | Création enrollment en DB |
| Webhook `session.created` | `POST /api/v1/dendreo/sessions` | Création session en DB |
| SSO JWT | `GET /api/v1/auth/dendreo-sso?jwt=...` | Cookie session + redirection vers /formations/[id] |
| Remontée progression | `POST https://hooks.dendreo.com/lms-progression` | Code 200, progression visible côté Dendreo |

Tous ces endpoints ont déjà été testés en local et préprod via simulation HMAC-SHA256 avec succès. Il ne reste plus qu'à tester avec un vrai appel Dendreo.

---

## 7. Configuration prévue du connecteur (à appliquer côté Dendreo dès activation)

### Section "Réglage de la connexion"
- **Nom du LMS** : `TAALMS`
- **Tenant ID** : `taa-formation`
- **Clé de signature** : générée Dendreo, à copier dans `DENDREO_SIGNATURE_KEY`

### Section "Accès API"
- **URL endpoint Trainings** : `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/trainings`
- **Header** : `{"X-Auth-API-Key": "<DENDREO_API_KEY>"}`
- **Champ ID** : `training_id`
- **Champ titre** : `training_title`
- **Champ description** : `training_description`

### Section "Webhooks"
- **Création utilisateur** : `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/users`
- **Inscription** : `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/enrolments`
- **Création session** : `https://artist-academyapi-production.up.railway.app/api/v1/dendreo/sessions`

### Section "Accès au LMS par les Participants"
- **URL de redirection** : `https://artist-academyweb-production.up.railway.app/formations/[training_id]?enrolment=[enrolment_id]`
- **URL JWT** : `https://artist-academyapi-production.up.railway.app/api/v1/auth/dendreo-sso`

---

## 8. Actions ouvertes

- [ ] Marina : activer le Connecteur LMS Universel sur la sandbox (ou autoriser tests sur prod)
- [ ] Une fois connecteur activé : configurer le formulaire avec les valeurs de §7
- [ ] Tester le flow complet : créer un participant sandbox → l'inscrire à une ADF → cliquer sur "Accès LMS" depuis l'extranet → arriver sur la formation
- [ ] Implémenter dans le LMS l'appel à l'API Dendreo pour récupérer `extranet_autologin_url` au moment des relances email
- [ ] Documenter la procédure de bascule sandbox → prod le jour du go-live

---

## 9. Liens utiles

- Doc Connecteur LMS Universel : (PDF dans `/mnt/project/Dendreo__Connecteur_LMS_universel.pdf`)
- Doc API Dendreo : https://developers.dendreo.com/
- Admin sandbox : https://pro.dendreo.com/the_artist_academy_sandbox
- Préprod LMS API : https://artist-academyapi-production.up.railway.app
- Préprod LMS Web : https://artist-academyweb-production.up.railway.app
