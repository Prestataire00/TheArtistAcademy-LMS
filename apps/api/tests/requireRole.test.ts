// Tests pour le middleware requireRole — modèle mono-rôle.
// requireRole(...required) autorise dès que user.role figure dans la liste
// des rôles requis. Pas de hiérarchie : chaque route liste explicitement
// les rôles autorisés.

import { UserRole } from '@prisma/client';
import { requireRole } from '../src/middleware/requireRole';
import { ForbiddenError } from '../src/shared/errors';

function makeReq(role: UserRole): any {
  return { user: { userId: 'u1', email: 'u@example.com', role } };
}

function expectForbidden(fn: () => void) {
  try {
    fn();
    throw new Error('Expected ForbiddenError, got nothing');
  } catch (err) {
    expect(err).toBeInstanceOf(ForbiddenError);
  }
}

describe('requireRole — mono-rôle', () => {
  it('autorise un user role=admin sur requireRole("admin")', () => {
    const req = makeReq('admin');
    const next = jest.fn();
    requireRole('admin')(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('refuse (403) un user role=trainer sur requireRole("admin")', () => {
    // Pas de hiérarchie : trainer ne devient pas admin implicitement.
    const req = makeReq('trainer');
    expectForbidden(() => requireRole('admin')(req, {} as any, jest.fn()));
  });

  it('autorise un user role=trainer sur requireRole("admin", "trainer")', () => {
    // OR sur la liste des rôles requis — le user a "trainer", autorisé.
    const req = makeReq('trainer');
    const next = jest.fn();
    requireRole('admin', 'trainer')(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("ne fait PAS de hiérarchie automatique — superadmin ne couvre pas 'learner'", () => {
    // Confirmation explicite : un superadmin n'a PAS automatiquement les
    // autres rôles. Pour l'autoriser, il faut le lister dans requireRole.
    const req = makeReq('superadmin');
    expectForbidden(() => requireRole('learner')(req, {} as any, jest.fn()));
  });

  it('refuse si req.user est absent', () => {
    expectForbidden(() => requireRole('admin')({} as any, {} as any, jest.fn()));
  });
});
