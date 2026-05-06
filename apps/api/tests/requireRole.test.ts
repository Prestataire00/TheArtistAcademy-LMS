// Tests pour le middleware requireRole — phase 2A multi-rôles.
// requireRole(...required) doit autoriser dès que user.roles a UNE
// intersection avec required. Plus de hiérarchie linéaire : un superadmin
// n'hérite plus automatiquement des autres rôles.

import { UserRole } from '@prisma/client';
import { requireRole } from '../src/middleware/requireRole';
import { ForbiddenError } from '../src/shared/errors';

function makeReq(roles: UserRole[]): any {
  return { user: { userId: 'u1', email: 'u@example.com', roles } };
}

function expectForbidden(fn: () => void) {
  try {
    fn();
    throw new Error('Expected ForbiddenError, got nothing');
  } catch (err) {
    expect(err).toBeInstanceOf(ForbiddenError);
  }
}

describe('requireRole — multi-rôles (phase 2A)', () => {
  it('autorise un user avec roles=[admin, learner] sur requireRole("admin")', () => {
    // Cas a) bis : un user multi-rôles passe les checks de chaque rôle qu'il détient.
    const req = makeReq(['admin', 'learner']);
    const next = jest.fn();
    requireRole('admin')(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('autorise le même user avec roles=[admin, learner] sur requireRole("learner")', () => {
    // Cas a) : un user admin+learner peut accéder à /admin ET aux pages apprenant.
    const req = makeReq(['admin', 'learner']);
    const next = jest.fn();
    requireRole('learner')(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('refuse (403) un user avec roles=[trainer, learner] sur requireRole("admin")', () => {
    // Cas b) : sans le rôle requis, refus net (plus de hiérarchie qui aurait
    // promu trainer en admin).
    const req = makeReq(['trainer', 'learner']);
    expectForbidden(() => requireRole('admin')(req, {} as any, jest.fn()));
  });

  it('autorise un user avec roles=[trainer] sur requireRole("admin", "trainer")', () => {
    // Cas c) : OR sur la liste des rôles requis — le user a "trainer", autorisé.
    const req = makeReq(['trainer']);
    const next = jest.fn();
    requireRole('admin', 'trainer')(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("ne fait PAS de hiérarchie automatique — superadmin ne couvre pas 'learner'", () => {
    // Confirmation explicite de la décision design : un superadmin n'a PAS
    // automatiquement les autres rôles. Si on veut qu'il accède à du contenu
    // learner, il faut lui ajouter explicitement 'learner' dans roles.
    const req = makeReq(['superadmin']);
    expectForbidden(() => requireRole('learner')(req, {} as any, jest.fn()));
  });

  it('refuse si req.user est absent', () => {
    expectForbidden(() => requireRole('admin')({} as any, {} as any, jest.fn()));
  });
});
