// Tests pour le helper toExternalIdString utilisé par les webhooks Dendreo.
// Dendreo envoie les ids (external_id, session_id, enrolment_id) en INT(11) ;
// Prisma exige des string sur les champs schéma (`String?`).

import { toExternalIdString } from '../src/modules/dendreo/dendreo.webhooks.service';

describe('toExternalIdString', () => {
  it('convertit un number en string', () => {
    expect(toExternalIdString(12345)).toBe('12345');
  });

  it('retourne null pour undefined', () => {
    expect(toExternalIdString(undefined)).toBeNull();
  });

  it('retourne null pour null', () => {
    expect(toExternalIdString(null)).toBeNull();
  });

  it('retourne "0" pour 0 (0 est un id valide, pas null)', () => {
    expect(toExternalIdString(0)).toBe('0');
  });

  it('passe une string telle quelle', () => {
    expect(toExternalIdString('12345')).toBe('12345');
  });

  it('passe une string vide telle quelle (différent de null)', () => {
    // "" != null donc on conserve la string vide. Le validateur upstream
    // rejette les valeurs vides via les checks de payload.
    expect(toExternalIdString('')).toBe('');
  });
});
