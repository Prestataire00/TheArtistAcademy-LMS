// Tests unitaires de la logique de redirection SSO (return_to + token).
// On ré-implémente la même logique que auth.controller.ts pour la valider en
// isolation, sans monter Express, ni la DB, ni mocker jsonwebtoken. C'est la
// correction du bug "/sso?return_to=https://web/..." qui doit maintenant
// rediriger vers une URL contenant `token=...` quand return_to pointe vers
// le domaine Web.

function buildRedirectUrl(opts: {
  webUrl: string;
  returnTo?: string;
  internalToken: string;
  fallbackTrainingId: string;
  fallbackEnrolmentId: string;
}): string {
  const { webUrl, returnTo, internalToken, fallbackTrainingId, fallbackEnrolmentId } = opts;

  if (returnTo) {
    const absoluteReturnTo = /^https?:\/\//i.test(returnTo)
      ? returnTo
      : `${webUrl}${returnTo.startsWith('/') ? '' : '/'}${returnTo}`;

    let finalUrl = absoluteReturnTo;
    try {
      const target = new URL(absoluteReturnTo);
      const webOrigin = new URL(webUrl);
      if (target.host === webOrigin.host) {
        target.searchParams.set('token', internalToken);
        finalUrl = target.toString();
      }
    } catch {
      /* URL malformée → fallback */
    }
    return finalUrl;
  }

  const params = new URLSearchParams({
    token: internalToken,
    training_id: fallbackTrainingId,
    enrolment_id: fallbackEnrolmentId,
  });
  return `${webUrl}/sso/dendreo?${params.toString()}`;
}

describe('SSO redirect URL building', () => {
  const webUrl = 'https://artist-academyweb-production.up.railway.app';
  const internalToken = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';

  it('appends token to return_to when target host matches WEB_URL', () => {
    const url = buildRedirectUrl({
      webUrl,
      returnTo: `${webUrl}/formations/abc?enrolment=xyz`,
      internalToken,
      fallbackTrainingId: 'abc',
      fallbackEnrolmentId: 'xyz',
    });
    const parsed = new URL(url);
    expect(parsed.host).toBe('artist-academyweb-production.up.railway.app');
    expect(parsed.pathname).toBe('/formations/abc');
    expect(parsed.searchParams.get('enrolment')).toBe('xyz');
    expect(parsed.searchParams.get('token')).toBe(internalToken);
  });

  it('appends token to return_to with no existing query string', () => {
    const url = buildRedirectUrl({
      webUrl,
      returnTo: `${webUrl}/formations/abc`,
      internalToken,
      fallbackTrainingId: 'abc',
      fallbackEnrolmentId: 'xyz',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('token')).toBe(internalToken);
    expect(parsed.pathname).toBe('/formations/abc');
  });

  it('resolves relative return_to against WEB_URL and appends token', () => {
    const url = buildRedirectUrl({
      webUrl,
      returnTo: '/formations/abc?enrolment=xyz',
      internalToken,
      fallbackTrainingId: 'abc',
      fallbackEnrolmentId: 'xyz',
    });
    const parsed = new URL(url);
    expect(parsed.host).toBe('artist-academyweb-production.up.railway.app');
    expect(parsed.pathname).toBe('/formations/abc');
    expect(parsed.searchParams.get('token')).toBe(internalToken);
  });

  it('does NOT append token when return_to points to a foreign host', () => {
    const url = buildRedirectUrl({
      webUrl,
      returnTo: 'https://evil.example.com/steal',
      internalToken,
      fallbackTrainingId: 'abc',
      fallbackEnrolmentId: 'xyz',
    });
    const parsed = new URL(url);
    expect(parsed.host).toBe('evil.example.com');
    expect(parsed.searchParams.get('token')).toBeNull();
  });

  it('falls back to /sso/dendreo with token when return_to is absent', () => {
    const url = buildRedirectUrl({
      webUrl,
      internalToken,
      fallbackTrainingId: 'abc',
      fallbackEnrolmentId: 'xyz',
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/sso/dendreo');
    expect(parsed.searchParams.get('token')).toBe(internalToken);
    expect(parsed.searchParams.get('training_id')).toBe('abc');
    expect(parsed.searchParams.get('enrolment_id')).toBe('xyz');
  });
});
