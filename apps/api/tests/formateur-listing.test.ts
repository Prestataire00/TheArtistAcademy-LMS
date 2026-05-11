// Conditions d'affichage des formations dans /formateur/sessions et
// /formateur/contenus.
//
// Règle métier (validée — table de vérité finale) :
//   - listEditableContent (/formateur/contenus, vue ÉDITION) :
//     trainerId match ET isPublished: true. Le nombre d'inscrits N'EST
//     PAS un critère (préparer le contenu en amont, avant inscrits).
//   - listSessions (/formateur/sessions, vue PILOTAGE pédagogique) :
//     trainerId match ET isPublished: true ET ≥1 inscrit. Une formation
//     publiée sans inscrit n'a rien à piloter → masquée ici (mais reste
//     visible dans /contenus pour l'édition).
//   - Module visible ssi `isPublished: true` dans les deux vues.
//   - UA visible ssi `isPublished: true` ET `type ∈ {quiz, resource}`
//     dans /contenus (le frontend ne sait pas éditer les autres types).
//
// On teste les services directement (pas via Express) : mocks Prisma au
// minimum, on inspecte les `where` envoyés et le shape retourné.

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'k',
    DENDREO_SIGNATURE_KEY: 'k',
    DENDREO_WEBHOOK_SECRET: '',
    DENDREO_API_KEY: 'k',
  },
}));

jest.mock('../src/shared/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const formationFindMany = jest.fn();
jest.mock('../src/config/database', () => ({
  prisma: {
    formation: { findMany: (...args: unknown[]) => formationFindMany(...args) },
  },
}));

import { listSessions } from '../src/modules/formateur/formateur.service';
import { listEditableContent } from '../src/modules/formateur/formateur.contenus.service';

const TRAINER_ID = 'u-trainer';

beforeEach(() => {
  formationFindMany.mockReset();
});

// ─── /formateur/sessions ─────────────────────────────────────────────────────

describe('listSessions — conditions d\'affichage (vue pilotage)', () => {
  it("filtre sur trainerId + isPublished + enrollments: { some: {} }", async () => {
    formationFindMany.mockResolvedValue([]);
    await listSessions(TRAINER_ID);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where).toEqual({
      trainerId: TRAINER_ID,
      isPublished: true,
      enrollments: { some: {} },
    });
  });

  it("retourne une formation avec ≥1 enrollment (cas nominal)", async () => {
    formationFindMany.mockResolvedValue([
      {
        id: 'f1',
        title: 'Avec apprenants',
        _count: { modules: 1 },
        modules: [{ uas: [{ id: 'ua1' }] }],
        enrollments: [
          { uaProgresses: [{ status: 'completed' }], formationProgress: null },
        ],
      },
    ]);
    const sessions = await listSessions(TRAINER_ID);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].formationId).toBe('f1');
    expect(sessions[0].learnersCount).toBe(1);
  });

  it("formation publiée SANS inscrit → MASQUÉE par le filtre DB enrollments: { some: {} }", async () => {
    // Une formation sans aucun inscrit n'a rien à piloter ici → Prisma
    // ne la renvoie pas. Le service voit [] et retourne []. On contraste
    // explicitement avec listEditableContent où elle DOIT apparaître.
    formationFindMany.mockResolvedValue([]);
    const sessions = await listSessions(TRAINER_ID);
    expect(sessions).toEqual([]);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where.enrollments).toEqual({ some: {} });
  });

  it("formation en BROUILLON → filtrée out par le where DB (where.isPublished: true)", async () => {
    formationFindMany.mockResolvedValue([]);
    await listSessions(TRAINER_ID);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where.isPublished).toBe(true);
  });

  it("non-régression : seules les formations avec ≥1 inscrit remontent", async () => {
    // On simule la query qui appliquerait le filtre `enrollments: some {}`
    // côté DB : elle ne renvoie QUE les formations avec inscrits. Le service
    // doit refléter ça (1-pour-1, pas de tri/filtre supplémentaire).
    formationFindMany.mockResolvedValue([
      {
        id: 'f-with-learners',
        title: 'Avec inscrits',
        _count: { modules: 1 },
        modules: [{ uas: [{ id: 'ua1' }] }],
        enrollments: [
          { uaProgresses: [], formationProgress: null },
          { uaProgresses: [], formationProgress: null },
        ],
      },
    ]);

    const sessions = await listSessions(TRAINER_ID);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].formationId).toBe('f-with-learners');
    expect(sessions[0].learnersCount).toBe(2);
  });
});

// ─── /formateur/contenus ─────────────────────────────────────────────────────

describe('listEditableContent — conditions d\'affichage', () => {
  it("filtre sur trainerId + isPublished, PAS sur enrollments", async () => {
    formationFindMany.mockResolvedValue([]);
    await listEditableContent(TRAINER_ID);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where).toEqual({ trainerId: TRAINER_ID, isPublished: true });
    expect(callArg.where.enrollments).toBeUndefined();
  });

  it("formation en BROUILLON → filtrée out par le where DB", async () => {
    formationFindMany.mockResolvedValue([]);
    await listEditableContent(TRAINER_ID);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where.isPublished).toBe(true);
  });

  it("formation publiée SANS inscrit → VISIBLE (contraste avec listSessions)", async () => {
    // Édition : le formateur doit pouvoir préparer le contenu d'une
    // formation publiée même sans inscrit. À comparer avec listSessions
    // où la même formation serait masquée (rien à piloter).
    formationFindMany.mockResolvedValue([
      { id: 'f-no-learners', title: 'Publiée 0 inscrit', modules: [] },
    ]);

    const data = await listEditableContent(TRAINER_ID);
    expect(data).toHaveLength(1);
    expect(data[0].formationId).toBe('f-no-learners');

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where.enrollments).toBeUndefined();
  });

  it("include modules : filtre isPublished=true (modules brouillons masqués côté DB)", async () => {
    formationFindMany.mockResolvedValue([]);
    await listEditableContent(TRAINER_ID);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.include.modules.where).toEqual({ isPublished: true });
  });

  it("include UAs : filtre isPublished=true ET type ∈ {quiz, resource}", async () => {
    formationFindMany.mockResolvedValue([]);
    await listEditableContent(TRAINER_ID);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.include.modules.include.uas.where).toEqual({
      isPublished: true,
      type: { in: ['quiz', 'resource'] },
    });
  });

  it("formation publiée AVEC modules publiés AVEC UA quiz/resource → la voit avec ses modules/UAs", async () => {
    formationFindMany.mockResolvedValue([
      {
        id: 'f1',
        title: 'Pleine de contenu',
        modules: [
          {
            id: 'm1',
            title: 'Module 1',
            uas: [
              {
                id: 'ua1',
                title: 'Quiz 1',
                type: 'quiz',
                quiz: { id: 'q1', _count: { questions: 3 } },
                resource: null,
              },
            ],
          },
        ],
      },
    ]);

    const data = await listEditableContent(TRAINER_ID);
    expect(data).toHaveLength(1);
    expect(data[0].formationId).toBe('f1');
    expect(data[0].modules).toHaveLength(1);
    expect(data[0].modules[0].uas).toHaveLength(1);
    expect(data[0].modules[0].uas[0].quiz).toEqual({ id: 'q1', questionsCount: 3 });
  });

  it("formation publiée AVEC modules publiés SANS UA éditable → la voit avec modules: []", async () => {
    // Soit le module n'a que des vidéos (type filtré), soit les UAs sont
    // toutes en brouillon (isPublished filtré). Dans les deux cas, le
    // module remonte avec uas: [] et est filtré par le service.
    formationFindMany.mockResolvedValue([
      {
        id: 'f-empty-ua',
        title: 'Que des vidéos / brouillons',
        modules: [
          { id: 'm1', title: 'Module 1', uas: [] },
        ],
      },
    ]);

    const data = await listEditableContent(TRAINER_ID);
    expect(data).toHaveLength(1);
    expect(data[0].formationId).toBe('f-empty-ua');
    expect(data[0].modules).toEqual([]);
  });

  it("formation publiée SANS modules publiés → la voit avec modules: []", async () => {
    // Cas : tous les modules sont en brouillon (filtrés à l'include) →
    // f.modules vient à []. La formation remonte quand même.
    formationFindMany.mockResolvedValue([
      { id: 'f-no-modules', title: 'Squelette', modules: [] },
    ]);

    const data = await listEditableContent(TRAINER_ID);
    expect(data).toHaveLength(1);
    expect(data[0].formationId).toBe('f-no-modules');
    expect(data[0].modules).toEqual([]);
  });

  it("module brouillon dans formation publiée → masqué (filtre include isPublished=true)", async () => {
    // Reproduit le scénario : Prisma filtre les modules brouillons à
    // l'include. Le mock simule ce filtre en ne renvoyant que les modules
    // publiés. On confirme que la clause where est bien en place.
    formationFindMany.mockResolvedValue([
      {
        id: 'f1',
        title: 'Mix publié + brouillon',
        modules: [
          {
            id: 'm-published',
            title: 'Module publié',
            uas: [
              { id: 'ua1', title: 'Q1', type: 'quiz', quiz: { id: 'q1', _count: { questions: 1 } }, resource: null },
            ],
          },
          // m-draft (isPublished=false) absent : déjà filtré par Prisma.
        ],
      },
    ]);

    const data = await listEditableContent(TRAINER_ID);
    expect(data[0].modules).toHaveLength(1);
    expect(data[0].modules[0].moduleId).toBe('m-published');

    // Vérifie aussi la clause where côté DB qui produit ce résultat.
    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.include.modules.where.isPublished).toBe(true);
  });

  it("UA brouillon dans module publié → masquée (filtre include isPublished=true)", async () => {
    // Prisma filtre les UAs brouillons à l'include nested. Le mock simule
    // ce filtre. On confirme la clause where + que seules les UAs
    // publiées remontent dans la réponse.
    formationFindMany.mockResolvedValue([
      {
        id: 'f1',
        title: 'UA mix',
        modules: [
          {
            id: 'm1',
            title: 'Module 1',
            uas: [
              { id: 'ua-published', title: 'Q publié', type: 'quiz', quiz: { id: 'q1', _count: { questions: 2 } }, resource: null },
              // ua-draft (isPublished=false) absent : déjà filtré par Prisma.
            ],
          },
        ],
      },
    ]);

    const data = await listEditableContent(TRAINER_ID);
    expect(data[0].modules[0].uas).toHaveLength(1);
    expect(data[0].modules[0].uas[0].id).toBe('ua-published');

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.include.modules.include.uas.where.isPublished).toBe(true);
  });
});
