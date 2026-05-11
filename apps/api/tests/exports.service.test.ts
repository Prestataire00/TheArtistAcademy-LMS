jest.mock('../src/config/database', () => ({
  prisma: {
    uAProgress: { findMany: jest.fn() },
    enrollment: { findMany: jest.fn() },
  },
}));

import { prisma } from '../src/config/database';
import { exportFinancier, exportProgressionDetaillee } from '../src/modules/exports/exports.service';

const mockFindUaProgress = prisma.uAProgress.findMany as jest.Mock;
const mockFindEnrollment = prisma.enrollment.findMany as jest.Mock;

beforeEach(() => {
  mockFindUaProgress.mockReset();
  mockFindEnrollment.mockReset();
});

// ─── Helpers de parsing CSV (sans dependance externe) ─────────────────────────

function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const cleaned = csv.replace(/^\ufeff/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.length > 0);
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        cells.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    cells.push(cur);
    return cells;
  };
  const all = lines.map(parseLine);
  return { headers: all[0] ?? [], rows: all.slice(1) };
}

function rowAsObject(headers: string[], row: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  headers.forEach((h, i) => { o[h] = row[i] ?? ''; });
  return o;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeUAProgress(overrides: Partial<{
  status: string;
  ipAddress: string | null;
  country: string | null;
  videoPercentWatched: number;
  timeSpentSeconds: number;
  firstAccessedAt: Date | null;
  completedAt: Date | null;
  uaType: 'video' | 'quiz' | 'resource';
  uaTitle: string;
  modulePosition: number;
  moduleTitle: string;
  formationTitle: string;
  fullName: string;
  email: string;
}> = {}) {
  return {
    id: 'p1',
    enrollmentId: 'enr1',
    uaId: 'ua1',
    status: overrides.status ?? 'completed',
    videoPositionSeconds: 0,
    videoPercentWatched: overrides.videoPercentWatched ?? 0,
    timeSpentSeconds: overrides.timeSpentSeconds ?? 0,
    firstAccessedAt: overrides.firstAccessedAt ?? new Date(Date.UTC(2026, 4, 11, 12, 0)),
    completedAt: overrides.completedAt ?? null,
    ipAddress: overrides.ipAddress ?? null,
    country: overrides.country ?? null,
    updatedAt: new Date(),
    enrollment: {
      user: { fullName: overrides.fullName ?? 'Eva Randrianasolo', email: overrides.email ?? 'eva@example.com' },
      formation: { title: overrides.formationTitle ?? 'Formation Test' },
    },
    ua: {
      title: overrides.uaTitle ?? 'UA 1',
      type: overrides.uaType ?? 'video',
      position: 0,
      module: { title: overrides.moduleTitle ?? 'Module 1', position: overrides.modulePosition ?? 0 },
    },
  };
}

// ─── exportFinancier ──────────────────────────────────────────────────────────

describe('exportFinancier', () => {
  it('produit le bon nombre de lignes (1 par UAProgress retourne)', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress(), makeUAProgress({ uaTitle: 'UA 2' }), makeUAProgress({ uaTitle: 'UA 3' })]);
    const csv = await exportFinancier({});
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(3);
  });

  it('emet les 12 colonnes dans l\'ordre exact specifie', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress()]);
    const csv = await exportFinancier({});
    const { headers } = parseCsv(csv);
    expect(headers).toEqual([
      'Prenom',
      'Nom',
      'Courriel',
      'Adresse IP',
      'Pays',
      'Nom de formation',
      'Nom du module',
      "Unite d'apprentissage",
      'Date de connexion',
      'Date de sortie',
      'Temps ecoule',
      'Progres (%)',
    ]);
  });

  it('formate IP et Pays a "-" quand null en DB', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress({ ipAddress: null, country: null })]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    const r = rowAsObject(headers, rows[0]);
    expect(r['Adresse IP']).toBe('-');
    expect(r['Pays']).toBe('-');
  });

  it('garde les valeurs IP et Pays quand presentes', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress({ ipAddress: '8.8.8.8', country: 'US' })]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    const r = rowAsObject(headers, rows[0]);
    expect(r['Adresse IP']).toBe('8.8.8.8');
    expect(r['Pays']).toBe('US');
  });

  it('formate Date de connexion en JJ/MM/AAAA hh:mm', async () => {
    // 11/05/2026 14:32 CEST = 12:32 UTC
    const d = new Date(Date.UTC(2026, 4, 11, 12, 32));
    mockFindUaProgress.mockResolvedValue([makeUAProgress({ firstAccessedAt: d })]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    expect(rowAsObject(headers, rows[0])['Date de connexion']).toBe('11/05/2026 14:32');
  });

  it('met Date de sortie a "-" quand completedAt null', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress({ status: 'in_progress', completedAt: null })]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    expect(rowAsObject(headers, rows[0])['Date de sortie']).toBe('-');
  });

  it('formate Temps ecoule en hh:mm:ss', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress({ timeSpentSeconds: 9314 })]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    expect(rowAsObject(headers, rows[0])['Temps ecoule']).toBe('02:35:14');
  });

  it('Progres (%) video : entier brut sans signe % (videoPercentWatched)', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress({ uaType: 'video', videoPercentWatched: 84, status: 'in_progress' })]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    const v = rowAsObject(headers, rows[0])['Progres (%)'];
    expect(v).toBe('84');
    expect(v).not.toContain('%');
  });

  it('Progres (%) quiz : "100" si completed, "0" sinon', async () => {
    mockFindUaProgress.mockResolvedValue([
      makeUAProgress({ uaType: 'quiz', status: 'completed', uaTitle: 'Q1' }),
      makeUAProgress({ uaType: 'quiz', status: 'in_progress', uaTitle: 'Q2' }),
    ]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    const map = Object.fromEntries(rows.map((r) => [rowAsObject(headers, r)["Unite d'apprentissage"], rowAsObject(headers, r)['Progres (%)']]));
    expect(map['Q1']).toBe('100');
    expect(map['Q2']).toBe('0');
  });

  it('Progres (%) ressource : "100" si completed, "0" sinon', async () => {
    mockFindUaProgress.mockResolvedValue([
      makeUAProgress({ uaType: 'resource', status: 'completed', uaTitle: 'R1' }),
      makeUAProgress({ uaType: 'resource', status: 'in_progress', uaTitle: 'R2' }),
    ]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    const map = Object.fromEntries(rows.map((r) => [rowAsObject(headers, r)["Unite d'apprentissage"], rowAsObject(headers, r)['Progres (%)']]));
    expect(map['R1']).toBe('100');
    expect(map['R2']).toBe('0');
  });

  it('split fullName en Prenom / Nom', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress({ fullName: 'Jean-Paul Dupont Martin' })]);
    const { headers, rows } = parseCsv(await exportFinancier({}));
    const r = rowAsObject(headers, rows[0]);
    expect(r['Prenom']).toBe('Jean-Paul');
    expect(r['Nom']).toBe('Dupont Martin');
  });

  it('passe les filtres formationId / sessionId / dates a Prisma', async () => {
    mockFindUaProgress.mockResolvedValue([]);
    await exportFinancier({ formationId: 'f1', sessionId: 's1', dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    const args = mockFindUaProgress.mock.calls[0][0];
    expect(args.where.enrollment.formationId).toBe('f1');
    expect(args.where.enrollment.dendreoSessionId).toBe('s1');
    expect(args.where.enrollment.status).toBe('active');
    expect(args.where.status).toEqual({ not: 'not_started' });
    expect(args.where.firstAccessedAt.gte).toEqual(new Date('2026-01-01'));
    expect(args.where.firstAccessedAt.lte).toEqual(new Date('2026-12-31'));
  });

  it('omet les filtres absents (where minimal)', async () => {
    mockFindUaProgress.mockResolvedValue([]);
    await exportFinancier({});
    const args = mockFindUaProgress.mock.calls[0][0];
    expect(args.where.enrollment.formationId).toBeUndefined();
    expect(args.where.enrollment.dendreoSessionId).toBeUndefined();
    expect(args.where.firstAccessedAt).toBeUndefined();
  });

  it('CSV commence par le BOM UTF-8 (compatibilite Excel)', async () => {
    mockFindUaProgress.mockResolvedValue([makeUAProgress()]);
    const csv = await exportFinancier({});
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });
});

// ─── exportProgressionModules ─────────────────────────────────────────────────

interface FixtureUA {
  id: string;
  type: 'video' | 'quiz' | 'resource';
  videoDurationSeconds?: number | null;
}

interface FixtureModule {
  id: string;
  title: string;
  position: number;
  uas: FixtureUA[];
}

interface FixtureProgress {
  uaId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  timeSpentSeconds?: number;
  firstAccessedAt?: Date | null;
  completedAt?: Date | null;
  updatedAt?: Date;
}

interface FixtureUADetailed extends FixtureUA {
  title?: string;
  position?: number;
}

interface FixtureModuleDetailed {
  id: string;
  title: string;
  position: number;
  uas: FixtureUADetailed[];
}

interface FixtureProgressDetailed extends FixtureProgress {
  videoPercentWatched?: number;
}

function makeEnrollmentForProgressionExport(overrides: {
  fullName?: string;
  email?: string;
  formationTitle?: string;
  modules?: FixtureModuleDetailed[];
  uaProgresses?: FixtureProgressDetailed[];
} = {}) {
  const modules: FixtureModuleDetailed[] = overrides.modules ?? [{
    id: 'm1', title: 'Module A', position: 0,
    uas: [
      { id: 'ua1', type: 'video', videoDurationSeconds: 600, title: 'UA Video', position: 0 },
      { id: 'ua2', type: 'quiz', title: 'UA Quiz', position: 1 },
    ],
  }];

  return {
    user: { fullName: overrides.fullName ?? 'Eva Randrianasolo', email: overrides.email ?? 'eva@example.com' },
    formation: {
      id: 'f1',
      title: overrides.formationTitle ?? 'Formation Test',
      modules: modules.map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        uas: m.uas.map((u, idx) => ({
          id: u.id,
          title: u.title ?? `UA ${u.id}`,
          type: u.type,
          position: u.position ?? idx,
          videoContent: u.type === 'video' ? { durationSeconds: u.videoDurationSeconds ?? 600 } : null,
        })),
      })),
    },
    uaProgresses: (overrides.uaProgresses ?? []).map((p) => ({
      uaId: p.uaId,
      status: p.status,
      videoPercentWatched: p.videoPercentWatched ?? 0,
      timeSpentSeconds: p.timeSpentSeconds ?? 0,
      firstAccessedAt: p.firstAccessedAt ?? null,
      completedAt: p.completedAt ?? null,
      updatedAt: p.updatedAt ?? new Date(),
    })),
  };
}

describe('exportProgressionDetaillee', () => {
  it('produit une ligne par UA par apprenant', async () => {
    mockFindEnrollment.mockResolvedValue([
      makeEnrollmentForProgressionExport({
        modules: [
          { id: 'm1', title: 'Module 1', position: 0, uas: [
            { id: 'u1', type: 'quiz' }, { id: 'u2', type: 'quiz' },
          ] },
          { id: 'm2', title: 'Module 2', position: 1, uas: [{ id: 'u3', type: 'quiz' }] },
        ],
      }),
      makeEnrollmentForProgressionExport({
        fullName: 'Bob Martin', email: 'bob@example.com',
        modules: [{ id: 'm1', title: 'Module 1', position: 0, uas: [{ id: 'u1', type: 'quiz' }] }],
      }),
    ]);
    const { rows } = parseCsv(await exportProgressionDetaillee({}));
    expect(rows).toHaveLength(4); // 3 UAs × Eva + 1 UA × Bob
  });

  it('emet les 18 colonnes dans l\'ordre exact specifie', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport()]);
    const { headers } = parseCsv(await exportProgressionDetaillee({}));
    expect(headers).toEqual([
      'Prenom',
      'Nom',
      'Courriel',
      'Nom de formation',
      'Nom du module',
      'Position du module',
      'Statut module',
      'Progression module (%)',
      'Temps passe sur le module',
      "Unite d'apprentissage",
      "Position de l'UA",
      'Type UA',
      'Statut UA',
      'Progression UA (%)',
      "Temps passe sur l'UA",
      'Date 1ere activite UA',
      'Date derniere activite UA',
      'Date completion UA',
    ]);
  });

  it('Progression module (%) ET Progression UA (%) sont des entiers bruts sans signe %', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'u1', type: 'video', videoDurationSeconds: 600, title: 'V1' },
        { id: 'u2', type: 'quiz', title: 'Q1' },
      ] }],
      uaProgresses: [
        { uaId: 'u1', status: 'in_progress', videoPercentWatched: 42 },
      ],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    rows.forEach((r) => {
      const o = rowAsObject(headers, r);
      expect(o['Progression module (%)']).toMatch(/^\d+$/);
      expect(o['Progression UA (%)']).toMatch(/^\d+$/);
      expect(o['Progression module (%)']).not.toContain('%');
      expect(o['Progression UA (%)']).not.toContain('%');
    });
  });

  it('multi-UA : 2 terminees + 2 non sur 4 UAs → statuts UA mixtes, Progression module identique sur les 4 lignes', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{
        id: 'm1', title: 'M', position: 0,
        uas: [
          { id: 'u1', type: 'quiz', title: 'Q1', position: 0 },
          { id: 'u2', type: 'quiz', title: 'Q2', position: 1 },
          { id: 'u3', type: 'quiz', title: 'Q3', position: 2 },
          { id: 'u4', type: 'quiz', title: 'Q4', position: 3 },
        ],
      }],
      uaProgresses: [
        { uaId: 'u1', status: 'completed' },
        { uaId: 'u2', status: 'completed' },
      ],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    expect(rows).toHaveLength(4);

    const objs = rows.map((r) => rowAsObject(headers, r));

    // 2 lignes Termine, 2 lignes Non démarré
    const statuts = objs.map((o) => o['Statut UA']);
    expect(statuts.filter((s) => s === 'Terminé')).toHaveLength(2);
    expect(statuts.filter((s) => s === 'Non démarré')).toHaveLength(2);

    // Progression module identique sur les 4 lignes (50% pondéré, tous quiz egaux)
    const moduleProgs = new Set(objs.map((o) => o['Progression module (%)']));
    expect(moduleProgs.size).toBe(1);
    expect([...moduleProgs][0]).toBe('50');

    // Statut module identique aussi (En cours)
    const moduleStatuts = new Set(objs.map((o) => o['Statut module']));
    expect(moduleStatuts.size).toBe(1);
    expect([...moduleStatuts][0]).toBe('En cours');
  });

  it('Type UA traduit en français : Video / Quiz / Ressource', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'u1', type: 'video', videoDurationSeconds: 100, title: 'V' },
        { id: 'u2', type: 'quiz', title: 'Q' },
        { id: 'u3', type: 'resource', title: 'R' },
      ] }],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    const map = Object.fromEntries(rows.map((r) => {
      const o = rowAsObject(headers, r);
      return [o["Unite d'apprentissage"], o['Type UA']];
    }));
    expect(map['V']).toBe('Video');
    expect(map['Q']).toBe('Quiz');
    expect(map['R']).toBe('Ressource');
  });

  it('Statut UA en FR avec accents (Non démarré / En cours / Terminé)', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'u1', type: 'quiz', title: 'A' },
        { id: 'u2', type: 'quiz', title: 'B' },
        { id: 'u3', type: 'quiz', title: 'C' },
      ] }],
      uaProgresses: [
        { uaId: 'u2', status: 'in_progress' },
        { uaId: 'u3', status: 'completed' },
      ],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    const map = Object.fromEntries(rows.map((r) => {
      const o = rowAsObject(headers, r);
      return [o["Unite d'apprentissage"], o['Statut UA']];
    }));
    expect(map['A']).toBe('Non démarré');
    expect(map['B']).toBe('En cours');
    expect(map['C']).toBe('Terminé');
  });

  it('Progression UA video utilise videoPercentWatched, quiz/resource = 100%/0%', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'uv', type: 'video', videoDurationSeconds: 600, title: 'V' },
        { id: 'uq', type: 'quiz', title: 'Q' },
        { id: 'ur', type: 'resource', title: 'R' },
      ] }],
      uaProgresses: [
        { uaId: 'uv', status: 'in_progress', videoPercentWatched: 42 },
        { uaId: 'uq', status: 'completed' },
        // ur reste not_started → 0%
      ],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    const map = Object.fromEntries(rows.map((r) => {
      const o = rowAsObject(headers, r);
      return [o["Unite d'apprentissage"], o['Progression UA (%)']];
    }));
    expect(map['V']).toBe('42');
    expect(map['Q']).toBe('100');
    expect(map['R']).toBe('0');
  });

  it("Date completion UA = '-' si non terminee, format JJ/MM/AAAA hh:mm sinon", async () => {
    const completedAt = new Date(Date.UTC(2026, 4, 11, 12, 32));
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'u1', type: 'quiz', title: 'Done' },
        { id: 'u2', type: 'quiz', title: 'NotDone' },
      ] }],
      uaProgresses: [
        { uaId: 'u1', status: 'completed', completedAt },
      ],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    const map = Object.fromEntries(rows.map((r) => {
      const o = rowAsObject(headers, r);
      return [o["Unite d'apprentissage"], o['Date completion UA']];
    }));
    expect(map['Done']).toBe('11/05/2026 14:32');
    expect(map['NotDone']).toBe('-');
  });

  it('inclut les UAs non démarrées (vue exhaustive, pas de filtre statut)', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'u1', type: 'quiz', title: 'A' },
        { id: 'u2', type: 'quiz', title: 'B' },
      ] }],
      uaProgresses: [], // aucun progress
    })]);
    const { rows } = parseCsv(await exportProgressionDetaillee({}));
    expect(rows).toHaveLength(2);
  });

  it("Position de l'UA est 1-indexed", async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'u1', type: 'quiz', position: 0, title: 'first' },
        { id: 'u2', type: 'quiz', position: 3, title: 'fourth' },
      ] }],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    const map = Object.fromEntries(rows.map((r) => {
      const o = rowAsObject(headers, r);
      return [o["Unite d'apprentissage"], o["Position de l'UA"]];
    }));
    expect(map['first']).toBe('1');
    expect(map['fourth']).toBe('4');
  });

  it('Temps passe sur le module = somme des UAs du module', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport({
      modules: [{ id: 'm1', title: 'M', position: 0, uas: [
        { id: 'u1', type: 'quiz' },
        { id: 'u2', type: 'quiz' },
      ] }],
      uaProgresses: [
        { uaId: 'u1', status: 'completed', timeSpentSeconds: 600 },
        { uaId: 'u2', status: 'in_progress', timeSpentSeconds: 314 },
      ],
    })]);
    const { headers, rows } = parseCsv(await exportProgressionDetaillee({}));
    const objs = rows.map((r) => rowAsObject(headers, r));
    // Memes valeurs sur les 2 lignes du meme module
    expect(objs[0]['Temps passe sur le module']).toBe('00:15:14');
    expect(objs[1]['Temps passe sur le module']).toBe('00:15:14');
  });

  it('passe les filtres formationId / sessionId a Prisma', async () => {
    mockFindEnrollment.mockResolvedValue([]);
    await exportProgressionDetaillee({ formationId: 'f1', sessionId: 's1' });
    const args = mockFindEnrollment.mock.calls[0][0];
    expect(args.where.formationId).toBe('f1');
    expect(args.where.dendreoSessionId).toBe('s1');
    expect(args.where.status).toBe('active');
  });

  it('CSV commence par le BOM UTF-8', async () => {
    mockFindEnrollment.mockResolvedValue([makeEnrollmentForProgressionExport()]);
    const csv = await exportProgressionDetaillee({});
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });
});
