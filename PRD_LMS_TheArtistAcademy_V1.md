**THE ARTIST ACADEMY**

**Product Requirements Document**

LMS Custom --- Remplacement Dokeos

  ---------------------------- ------------------------------------------
  **Version**                  V1.1

  **Date**                     Mai 2026

  **Statut**                   Draft --- Pour revue

  **Commanditaire**            The Artist Academy
  ---------------------------- ------------------------------------------

**1. Contexte & Objectif**

**1.1 Contexte**

The Artist Academy utilise actuellement Dokeos comme LMS, couplé à
Dendreo comme outil de gestion administrative des formations.
L\'objectif est de remplacer Dokeos par un LMS développé sur mesure
(vibecoding), mieux adapté aux besoins spécifiques de l\'organisme, sans
copier le modèle Dokeos.

**1.2 Vision du produit**

Créer un LMS simple, performant et parfaitement intégré à Dendreo,
permettant de délivrer des parcours e-learning de qualité (vidéos, quiz,
ressources) avec un suivi rigoureux, en conservant Dendreo comme unique
porte d\'entrée administrative et apprenant.

**1.3 Ce que ce LMS N\'est PAS**

-   Un portail autonome avec gestion des inscriptions --- Dendreo reste
    la référence

-   Un clone de Dokeos --- les choix fonctionnels sont reconsidérés

-   Une plateforme SCORM/xAPI avancée

-   Un système avec forum, messagerie interne ou visioconférence

-   Un outil de correction manuelle systématique de productions

**1.4 Périmètre inclus dans la V1**

  -----------------------------------------------------------------------
  **✅ Inclus V1**                    **❌ Hors scope**
  ----------------------------------- -----------------------------------
  SSO Dendreo (1 clic, JWT)           Forum / messagerie interne

  Vidéo streaming adaptatif + reprise Visioconférence

  Quiz : QCM / Vrai-Faux / réponse    SCORM / xAPI avancés
  courte                              

  Ressources téléchargeables PDF/PPT  Correction manuelle systématique

  Suivi : progression, temps passé,   Portail LMS autonome
  logs                                

  Reporting + exports CSV             Gestion inscriptions (= Dendreo)

  Relances email automatiques +       BI avancée
  journal                             
  -----------------------------------------------------------------------

**2. Volumétrie & Contraintes Techniques**

**2.1 Volumétrie**

  -----------------------------------------------------------------------
  **Indicateur**              **Valeur**
  --------------------------- -------------------------------------------
  Apprenants actifs           \~200 / mois

  Charge vidéo                Streaming adaptatif, pic usage simultané
                              faible

  Sessions simultanées        Ordre de grandeur : \< 50 simultanées

  Stockage vidéo              À contractualiser avec prestataire
                              hébergement
  -----------------------------------------------------------------------

**2.2 Contraintes d\'hébergement**

-   Vidéos uploadées et stockées côté LMS (prestataire), avec
    transcodage

-   Streaming adaptatif (HLS ou équivalent) selon le débit apprenant

-   URLs vidéo protégées par token/signature (non transférables)

-   MCO/MCS assurés par le prestataire : supervision, correctifs
    sécurité

-   Sauvegardes + restauration documentées + réversibilité (export
    complet) à contractualiser

-   Objectifs RPO/RTO/SLA à définir contractuellement

**2.3 Stack technique recommandée**

À définir avec le prestataire de développement. Contraintes minimales :

-   Backend : API REST sécurisée, gestion JWT pour SSO Dendreo

-   Frontend : interface responsive (desktop + mobile)

-   Base de données : traçabilité complète des événements apprenant

-   Intégration Dendreo via Connecteur LMS Universel (JWT SSO +
    Webhooks)

**3. Modèle Pédagogique**

**3.1 Hiérarchie des entités**

  ---------------------------------------------------------------------------
  **Entité**          **Définition**          **Particularités**
  ------------------- ----------------------- -------------------------------
  Formation           Ensemble structuré de   Porte son propre suivi de
                      modules                 progression

  Module              Composant de la         Peut être verrouillé (mode
                      formation regroupant 1  linéaire)
                      ou plusieurs UA         

  UA (Unité           Plus petite unité       1 vidéo OU 1 quiz OU 1
  d\'Apprentissage)   suivie --- 1 seul       ressource
                      élément                 
  ---------------------------------------------------------------------------

**3.2 Modes de parcours**

-   Linéaire : le module N doit être terminé pour déverrouiller le
    module N+1

-   Non linéaire : accès libre à tous les modules

Le mode de parcours est paramétrable par formation (niveau Admin).

**3.3 Statuts UA / Module / Formation**

  -----------------------------------------------------------------------
  **Statut**          **Condition**             **Impact**
  ------------------- ------------------------- -------------------------
  Non démarrée        Aucune interaction avec   Module/Formation = Non
                      l\'UA                     démarré(e)

  En cours            Interaction initiée,      Module/Formation = En
                      seuil non atteint         cours

  Terminée (=         Vidéo ≥ 99% visionnée /   Compte dans le calcul de
  Validée)            Quiz soumis / Ressource   progression
                      ouverte                   
  -----------------------------------------------------------------------

**3.4 Règles de complétion**

-   UA Vidéo : terminée si visionnage ≥ 99% (seuil paramétrable, défaut
    99%)

-   UA Quiz : terminée à la première soumission (peu importe le score)

-   UA Ressource : terminée à l\'ouverture/téléchargement

-   Module : progression = moyenne pondérée des UA (par durée)

-   Formation : progression = moyenne pondérée des modules (par durée)

-   Formation terminée/validée si progression ≥ 99%

**3.5 Reprise dynamique (vidéo)**

Le lecteur vidéo reprend automatiquement au dernier point de lecture
lors d\'une reconnexion. La progression est sauvegardée en temps réel
(ou à interval court).

**4. Intégration Dendreo --- SSO & Synchronisation**

**4.1 Principe général**

Dendreo est l\'unique porte d\'entrée apprenant et la référence
administrative. Le LMS n\'a pas de page de connexion propre pour les
apprenants. L\'accès se fait exclusivement via l\'Extranet Participant
Dendreo.

**4.2 Mécanisme SSO (JWT)**

-   Dendreo génère un token JWT signé contenant l\'identité de
    l\'apprenant et l\'identifiant d\'inscription (enrolment_id ou
    couple formation+session)

-   Le LMS valide le JWT, crée ou met à jour le compte apprenant à la
    volée (sans doublon)

-   L\'apprenant arrive directement sur la formation ciblée --- sans
    portail LMS intermédiaire

-   Authentification JWT fortement recommandée (spec Connecteur LMS
    Universel Dendreo)

**4.3 Gestion des accès par dates Dendreo**

  -----------------------------------------------------------------------
  **Cas**             **Comportement Dendreo**  **Comportement LMS**
  ------------------- ------------------------- -------------------------
  Session future      Bouton accès LMS          Inaccessible (pas de SSO
                      désactivé                 possible)

  Session active      Bouton activé (start_date Accès complet au contenu
                      → end_date)               et ressources

  Session close       Bouton désactivé          Inaccessible (plus de
                                                token valide)
  -----------------------------------------------------------------------

**4.4 Synchronisation des données**

-   Création automatique des comptes apprenants à l\'accès (minimum)

-   Mise à jour automatique sans doublons

-   Synchronisation de la progression vers Dendreo via Webhooks LMS →
    Dendreo

-   Données synchronisées : progression (%), score, temps passé, statut,
    dates 1ère/dernière connexion

**4.5 Diagnostic & Logs SSO**

-   Logs SSO : succès / échec avec messages exploitables

-   Page d\'état admin : dernière synchronisation, dernière activité

-   Journalisation des erreurs JWT (token expiré, signature invalide,
    utilisateur inconnu\...)

**4.6 Navigation retour**

Dans l\'interface LMS, le menu/bouton « Mes formations » renvoie vers
Dendreo (Extranet Participant). Il n\'existe pas de portail LMS autonome
côté apprenant.

**5. Profil Apprenant --- Besoins Fonctionnels**

**5.1 Accès & démarrage**

-   Accès uniquement via SSO depuis l\'Extranet Participant Dendreo

-   Arrivée directe sur la formation ciblée (correspondant à
    l\'inscription ayant déclenché le clic)

-   Contrôle d\'accès backend strict : limité au compte apprenant et à
    ses inscriptions actives

-   Bouton/menu « Mes formations » renvoie vers Dendreo

**5.2 Page formation (landing après SSO)**

-   Titre et description de la formation

-   Progression globale (pourcentage + barre visuelle)

-   Temps passé cumulé

-   Dates d\'accès (start_date / end_date Dendreo)

-   Bouton « Reprendre / Continuer »

-   Liste des modules avec statuts et progression

**5.3 Consommation des contenus**

**Vidéo**

-   Streaming adaptatif (HLS, adapté au débit de l\'apprenant)

-   Reprise automatique au dernier point de lecture

-   Règle de complétion : ≥ 99% visionné (seuil paramétrable)

-   Statut mis à jour en temps réel

**Quiz**

-   Types supportés : QCM, Vrai/Faux, Réponse courte (texte libre
    déclaratif)

-   Auto-correction immédiate pour QCM et Vrai/Faux uniquement

-   Réponse courte : enregistrée en déclaratif, sans auto-correction

-   Non bloquant : le résultat n\'impacte jamais la complétion

-   Tentatives illimitées

-   Historique minimal : tentative n°, date/heure, score (QCM/VF)

**Ressources**

-   Téléchargement direct de fichiers PDF, PPT, fiches

-   Accès via l\'onglet Ressources de la formation

-   Classement par module + vue globale « tout »

-   Accès soumis aux dates Dendreo (start_date → end_date)

**5.4 Suivi visible apprenant**

-   Progression par formation / module / UA avec statuts visuels

-   Temps passé cumulé (si affiché côté apprenant)

-   Scores quiz (informatifs, non bloquants)

-   Dernière activité

**5.5 Pages minimum attendues**

  -----------------------------------------------------------------------
  **Page**            **Contenu**
  ------------------- ---------------------------------------------------
  Page Formation      Progression, temps passé, dates, bouton
  (landing)           Reprendre/Continuer, liste modules

  État En cours       Boutons Continuer/Revoir, modules verrouillés si
                      mode linéaire

  État Terminé        Écran \'Formation terminée\' + accès Revoir/Accéder
                      tant que l\'accès Dendreo est ouvert

  Lecteur vidéo       Player adaptatif, barre progression, reprise,
                      contrôles standard

  Page quiz           Affichage questions, soumission, résultat immédiat
                      (QCM/VF)

  Onglet Ressources   Liste fichiers classés par module + vue globale
  -----------------------------------------------------------------------

**6. Profil Formateur --- Besoins Fonctionnels**

**6.1 Suivi pédagogique**

-   Accès à la liste des apprenants par session / action de formation

-   Vue individuelle par apprenant : statuts et progression (formation /
    module / UA), temps passé, historique quiz (scores, tentatives),
    réponses courtes déclaratives

-   Identification rapide des apprenants « à risque » (retard /
    inactivité) via filtres et statuts

**6.2 Pilotage --- statistiques formateur**

  -----------------------------------------------------------------------
  **Indicateur**              **Granularité**
  --------------------------- -------------------------------------------
  Taux de complétion          Par session + par module/UA
  (terminé)                   

  Progression moyenne         Par session + par module/UA

  Temps moyen passé           Par session + par module/UA

  Score moyen QCM/VF          Par session + par module/UA
  (informatif)                

  Liste apprenants non        Par session
  terminés                    
  -----------------------------------------------------------------------

**6.3 Gestion des contenus (si permission attribuée)**

-   Ajout / mise à jour de ressources (PDF/PPT/fiches) selon permissions

-   Création / mise à jour de quiz (QCM/VF/réponse courte) selon
    permissions

-   Pas de gestion d\'inscriptions (réservée à Dendreo / Admin)

**7. Profil Administrateur --- Besoins Fonctionnels**

**7.1 Gestion du catalogue**

-   Création / édition / suppression : formations, modules, UA (vidéo ou
    quiz ou ressource)

-   Duplication de modules avec leurs ressources

-   Paramétrage du mode de parcours (linéaire / non linéaire) par
    formation

-   Gestion des quiz : types autorisés, auto-correction QCM/VF,
    tentatives illimitées, historisation

-   Paramétrage du seuil de complétion vidéo (défaut 99%)

**7.2 Gestion des rôles & permissions**

  -------------------------------------------------------------------------------------
  **Fonctionnalité**   **Apprenant**   **Formateur**   **Admin**      **Super-admin**
  -------------------- --------------- --------------- -------------- -----------------
  Accès contenu +      ✅              ✅ (lecture)    ✅             ✅
  ressources                                                          

  Suivi sa progression ✅              ✅ (ses         ✅             ✅
                                       sessions)                      

  Suivi tous           ❌              ✅ (ses         ✅             ✅
  apprenants                           sessions)                      

  Gestion contenus     ❌              ✅ (si accordé) ✅             ✅

  Exports + logs       ❌              ❌              ✅             ✅

  Relances +           ❌              ❌              ✅             ✅
  paramétrage                                                         

  Config SSO + système ❌              ❌              ✅             ✅
  -------------------------------------------------------------------------------------

**7.3 SSO Dendreo & synchronisation**

-   Configuration du SSO et routage : accès LMS initié depuis Dendreo

-   Ouverture contextuelle : utilisation de l\'enrolment_id ou couple
    formation+session transmis

-   Gestion automatisée création/mise à jour des comptes et inscriptions
    à l\'accès (sans doublons)

-   Diagnostic : logs SSO (succès/échec), messages exploitables, page
    d\'état

**7.4 Traçabilité & conformité**

-   Traçabilité renforcée : logs d\'activité, temps passé actif, statuts
    terminée/validée (≥ 99%), horodatage

-   Suivi minimal : progression + scores

-   Exports CSV par période/session :

    -   Progression (formation / module / UA)

    -   Temps passé

    -   Scores et tentatives quiz

    -   Réponses courtes déclaratives

    -   Logs d\'activité

-   Journalisation des actions admin sensibles (exports, paramétrages)

**7.5 Relances email automatiques**

-   Règle V1 : module non terminé après X jours → relance automatique (X
    paramétrable)

-   Paramètres configurables : fenêtre d\'envoi (jours/heure),
    exclusions (déjà terminé / accès clôturé / désinscrit)

-   Journal admin exportable : règle déclenchante, destinataire,
    date/heure, statut envoyé/échec, template utilisé/version

**7.5.1 Lien d\'accès dans les emails**

Conformément au principe « Dendreo = porte d\'entrée unique apprenant »
(cf. §4), le lien d\'accès contenu dans les emails de relance pointe
vers l\'Extranet Participant Dendreo. Le LMS NE génère PAS de token
d\'accès direct côté LMS pour ces emails.

Le LMS utilise le champ extranet_autologin_url fourni par l\'API Dendreo
(GET /participants/[id]) pour générer un lien d\'autologin direct vers
l\'Extranet du participant.

**Architecture :**

-   À la création/mise à jour d\'un compte apprenant (webhooks Dendreo :
    user.created, enrolment.created), le LMS appelle l\'API Dendreo
    pour récupérer extranet_autologin_url et le stocke en base sur la
    fiche apprenant

-   Le service de relance email injecte cette URL dans la variable
    {{lien_formation}} (ou équivalent) du template au moment du rendu

**Comportement utilisateur :**

-   L\'apprenant clique sur le lien dans l\'email

-   Il est connecté automatiquement à son Extranet Dendreo (autologin)

-   Il accède au LMS via le bouton SSO de Dendreo (déjà fonctionnel)

**Fallback :**

-   Si extranet_autologin_url n\'est pas disponible (ex: erreur API au
    moment de la création), le LMS utilise l\'URL Extranet standard
    (`https://extranet.[centre].com`) en fallback

-   L\'apprenant devra saisir ses identifiants Dendreo dans ce cas

**Sécurité :**

-   L\'URL d\'autologin est confidentielle et ne doit pas être partagée

-   Elle est stockée en base sur la fiche apprenant

-   Sa durée de validité est gérée par Dendreo

**Bénéfices :**

-   1 clic pour l\'apprenant (autologin Dendreo)

-   Conforme à la philosophie « Dendreo orchestre l\'accès apprenant »

-   Pas de seconde porte d\'entrée à sécuriser côté LMS

-   Cohérent avec le bouton « Mes formations » qui renvoie déjà vers
    l\'Extranet Dendreo (cf. §5.1, §4.6)

**8. Logs & Traçabilité**

Tous les événements suivants doivent être journalisés avec horodatage et
identifiant apprenant :

  -----------------------------------------------------------------------
  **Catégorie**       **Événements**                  **Données
                                                      stockées**
  ------------------- ------------------------------- -------------------
  SSO                 Succès / Échec de connexion     user_id, timestamp,
                                                      résultat, erreur

  Navigation          Accès formation / module / UA   user_id, entity_id,
                                                      timestamp

  Vidéo               Démarrage / Reprise / Fin + %   user_id, video_id,
                      progression                     position, timestamp

  Quiz                Soumission, score, n° tentative user_id, quiz_id,
                                                      score, tentative,
                                                      timestamp

  Relances            Envoi email relance             règle,
                                                      destinataire,
                                                      template, statut,
                                                      timestamp

  Admin               Exports, paramétrages sensibles admin_id, action,
                                                      timestamp
  -----------------------------------------------------------------------

**9. Reporting & Exports**

**9.1 Tableaux de bord**

Des tableaux de bord simples sont disponibles pour Admin et Formateur
(pas de BI avancée).

**9.2 Indicateurs minimum**

-   Progression (formation / module / UA) + statuts + dates

-   Temps passé actif : total + par module/UA

-   Quiz : scores QCM/VF + tentatives + dates

-   Dernière activité (pas uniquement \'dernière connexion\')

**9.3 Exports CSV**

  -----------------------------------------------------------------------
  **Type d\'export**      **Contenu**
  ----------------------- -----------------------------------------------
  Apprenants par session  Identité + progression + temps + quiz +
                          dernière activité

  Modules/UA par session  Agrégats + détail par apprenant

  Logs événements         Événements horodatés, filtrables par
                          période/session

  Journal relances        Règle, destinataire, date/heure, statut,
                          template
  -----------------------------------------------------------------------

**10. Gestion Vidéo & Hébergement**

**10.1 Upload & transcodage**

-   Les vidéos sont uploadées depuis l\'interface Admin du LMS

-   Transcodage automatique vers les formats de streaming (HLS minimum)

-   Format source accepté : à préciser par le prestataire (MP4 H.264
    recommandé en entrée)

**10.2 Streaming**

-   Streaming adaptatif (HLS / DASH) selon le débit apprenant

-   Lecture sur tous les navigateurs modernes (desktop + mobile)

-   Reprise au dernier point de lecture (position sauvegardée côté
    serveur)

**10.3 Sécurité des accès vidéo**

-   URLs protégées par token signé (expiration courte)

-   Un token vidéo ne peut pas être utilisé par un utilisateur non
    authentifié

-   Contrôle d\'accès backend : vérification inscription active avant
    délivrance du token

**10.4 Continuité de service**

-   Sauvegardes régulières (fréquence à contractualiser)

-   Procédure de restauration documentée

-   Reprise sans perte de progression apprenant après incident

-   Objectifs RPO / RTO / SLA à définir et contractualiser

**11. User Stories --- Synthèse**

**11.1 Apprenant**

  ----------------------------------------------------------------------------
  **\#**   **En tant que...**                **Je veux...**
  -------- --------------------------------- ---------------------------------
  1        Apprenant Dendreo                 Accéder à ma formation en 1 clic
                                             depuis mon Extranet Dendreo, sans
                                             recréer de compte

  2        Apprenant                         Arriver directement sur ma
                                             formation, sans naviguer dans un
                                             portail LMS

  3        Apprenant                         Reprendre ma vidéo là où je l\'ai
                                             arrêtée la dernière fois

  4        Apprenant                         Faire un quiz sans que ça bloque
                                             ma progression même si j\'ai un
                                             mauvais score

  5        Apprenant                         Télécharger les ressources
                                             PDF/PPT associées à ma formation

  6        Apprenant                         Voir ma progression globale et
                                             par module en temps réel
  ----------------------------------------------------------------------------

**11.2 Formateur**

  ----------------------------------------------------------------------------
  **\#**   **En tant que...**                **Je veux...**
  -------- --------------------------------- ---------------------------------
  7        Formateur                         Voir la progression de chacun de
                                             mes apprenants par session

  8        Formateur                         Identifier rapidement les
                                             apprenants en retard ou inactifs

  9        Formateur                         Consulter les réponses courtes
                                             déclaratives de mes apprenants

  10       Formateur (si permission)         Ajouter ou mettre à jour des
                                             ressources sur ma formation
  ----------------------------------------------------------------------------

**11.3 Administrateur**

  ----------------------------------------------------------------------------
  **\#**   **En tant que...**                **Je veux...**
  -------- --------------------------------- ---------------------------------
  11       Admin                             Créer et organiser formations,
                                             modules et UA depuis le
                                             back-office

  12       Admin                             Dupliquer un module avec toutes
                                             ses ressources

  13       Admin                             Configurer le SSO Dendreo et
                                             diagnostiquer les erreurs de
                                             connexion

  14       Admin                             Exporter les données de
                                             progression et logs en CSV par
                                             session

  15       Admin                             Configurer des relances email
                                             automatiques et consulter leur
                                             journal d\'envoi

  16       Admin                             Paramétrer le seuil de complétion
                                             vidéo par formation
  ----------------------------------------------------------------------------

**12. Critères d\'Acceptance & Définition of Done**

**12.1 SSO & Accès**

-   ✅ Un apprenant clique depuis Dendreo et arrive directement sur sa
    formation en \< 3 secondes

-   ✅ Aucun formulaire de connexion LMS n\'est présenté à l\'apprenant

-   ✅ Un token JWT invalide ou expiré retourne une page d\'erreur
    claire

-   ✅ L\'accès est impossible si la date Dendreo est dépassée

**12.2 Vidéo**

-   ✅ La vidéo reprend exactement au dernier point de lecture après
    déconnexion/reconnexion

-   ✅ Le statut passe à « Terminée » dès que le seuil de visionnage est
    atteint

-   ✅ Une URL vidéo copiée et ouverte sans token valide retourne une
    erreur 403

**12.3 Quiz**

-   ✅ Un apprenant avec 0% à un quiz peut continuer et terminer sa
    formation normalement

-   ✅ L\'historique des tentatives (date, score, n°) est accessible
    formateur et admin

**12.4 Exports & Logs**

-   ✅ L\'export CSV par session contient tous les champs requis
    (section 9.3)

-   ✅ Chaque accès vidéo, soumission quiz et action admin est tracé
    avec horodatage

**12.5 Relances**

-   ✅ Une relance est envoyée après X jours d\'inactivité sur un module
    non terminé

-   ✅ Aucune relance n\'est envoyée à un apprenant dont la formation
    est terminée ou l\'accès clôturé

-   ✅ Le journal admin affiche bien le statut d\'envoi de chaque
    relance

-   ✅ Le lien contenu dans l\'email pointe vers l\'Extranet Participant
    Dendreo (extranet_autologin_url) --- aucun token d\'accès direct
    n\'est généré côté LMS (cf. §7.5.1)

**13. Glossaire**

  -----------------------------------------------------------------------
  **Terme**           **Définition**
  ------------------- ---------------------------------------------------
  UA                  Unité d\'Apprentissage : plus petite entité du LMS.
                      1 UA = 1 vidéo OU 1 quiz OU 1 ressource

  SSO                 Single Sign-On : connexion unique depuis Dendreo
                      vers le LMS via JWT, sans second identifiant

  JWT                 JSON Web Token : standard d\'authentification
                      sécurisé utilisé pour le SSO Dendreo

  enrolment_id        Identifiant d\'inscription Dendreo transmis au LMS
                      pour l\'ouverture contextuelle de la formation

  Streaming adaptatif Technique vidéo (HLS/DASH) qui adapte la qualité
                      selon le débit réseau de l\'apprenant

  Complétion          Statut \'Terminée\' d\'une UA / module / formation,
                      basé sur les règles de progression définies

  RPO / RTO           Recovery Point/Time Objective : objectifs de
                      reprise après incident à contractualiser

  Relance             Email automatique envoyé par le LMS à un apprenant
                      inactif selon règles paramétrables

  Connecteur          Module Dendreo permettant d\'intégrer un LMS custom
  universel           via JWT SSO + Webhooks

  Webhook             Mécanisme de notification HTTP du LMS vers Dendreo
                      pour synchroniser la progression

  extranet_autologin_url Champ retourné par l\'API Dendreo (GET
                      /participants/[id]) contenant un lien d\'autologin
                      direct vers l\'Extranet Participant Dendreo.
                      Utilisé par le LMS dans les emails de relance pour
                      offrir un accès en 1 clic sans seconde porte
                      d\'entrée
  -----------------------------------------------------------------------

**14. Changelog**

  -----------------------------------------------------------------------
  **Version**   **Date**       **Modifications**
  ------------- -------------- ------------------------------------------
  V1.0          Avril 2026     Version initiale

  V1.1          Mai 2026       §7.5 : précision sur l\'architecture du
                               lien dans les emails de relance
                               (utilisation de extranet_autologin_url
                               Dendreo, pas de token LMS). Ajout §7.5.1.
                               Mise à jour §12.5 (critère d\'acceptance).
                               Ajout entrée glossaire
                               extranet_autologin_url
  -----------------------------------------------------------------------

*--- Fin du document PRD LMS --- The Artist Academy V1.1 ---*
