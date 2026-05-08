// Phase 2A bis — chantier 3 (fix runtime) : conditions d'affichage des
// formations dans /formateur/sessions et /formateur/contenus.
//
// Règles métier :
//   - /formateur/sessions  : trainerId + isPublished + ≥1 enrollment
//   - /formateur/contenus  : trainerId + isPublished (peu importe le contenu)
//     → une formation publiée sans contenu éditable doit remonter avec
//       modules: [] pour qu'on l'affiche avec un état vide explicite,
//       au lieu d'être masquée et de faire croire à l'absence d'assignation.
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

describe('listSessions — conditions d\'affichage', () => {
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

  it("retourne une formation publiée avec ≥1 enrollment (cas nominal)", async () => {
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

  it("retourne [] si la query Prisma renvoie [] (formation sans enrollment ou non publiée)", async () => {
    // La condition where: { isPublished + enrollments: { some: {} } }
    // est appliquée côté DB ; on simule juste son résultat vide pour
    // confirmer que le service ne crée pas d'entrée fantôme.
    formationFindMany.mockResolvedValue([]);
    const sessions = await listSessions(TRAINER_ID);
    expect(sessions).toEqual([]);
  });
});

// ─── /formateur/contenus ─────────────────────────────────────────────────────

describe('listEditableContent — conditions d\'affichage', () => {
  it("filtre sur trainerId + isPublished, PAS sur la présence de contenu", async () => {
    formationFindMany.mockResolvedValue([]);
    await listEditableContent(TRAINER_ID);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where).toEqual({
      trainerId: TRAINER_ID,
      isPublished: true,
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

  it("formation publiée AVEC modules publiés SANS UA quiz/resource → la voit avec modules: []", async () => {
    // La query Prisma include filtre les UAs au niveau include (type: quiz/resource).
    // Si aucun module n'a d'UA matchant, m.uas vient à []. Le service filtre
    // alors les modules sans UAs (.filter), mais ne filtre PLUS la formation
    // entière → la formation remonte avec modules: [].
    formationFindMany.mockResolvedValue([
      {
        id: 'f-empty-ua',
        title: 'Que des vidéos',
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
    formationFindMany.mockResolvedValue([
      { id: 'f-no-modules', title: 'Squelette', modules: [] },
    ]);

    const data = await listEditableContent(TRAINER_ID);
    expect(data).toHaveLength(1);
    expect(data[0].formationId).toBe('f-no-modules');
    expect(data[0].modules).toEqual([]);
  });

  it("formation NON publiée → la query DB la filtre out (where.isPublished: true), pas dans la réponse", async () => {
    // Confirmation que le filtre DB suffit : si la formation n'est pas
    // publiée, Prisma ne la renvoie pas → service renvoie [].
    formationFindMany.mockResolvedValue([]);
    const data = await listEditableContent(TRAINER_ID);
    expect(data).toEqual([]);

    const callArg = formationFindMany.mock.calls[0][0];
    expect(callArg.where.isPublished).toBe(true);
  });
});
