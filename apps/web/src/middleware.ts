import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/admin', '/formateur'];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ─── Interception du ticket SSO ─────────────────────────────────────────────
  // L'API SSO Dendreo redirige vers `/<page>?token=<internalJwt>` quand un
  // return_to est fourni (cf. apps/api auth.controller.ts). Web et API étant
  // sur deux domaines Railway distincts, on ne peut pas poser le cookie API
  // sur le domaine Web : on capture le token en URL ici, on le transforme en
  // cookie HttpOnly côté Web, puis on redirige vers la même URL sans le
  // paramètre. Les fetchs `/api/v1/...` (rewrite vers l'API) embarqueront le
  // cookie via `credentials: 'include'`.
  const ssoToken = searchParams.get('token');
  if (ssoToken) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete('token');

    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set('token', ssoToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8h en secondes (NextResponse cookies)
    });
    return response;
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get('token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Le token existe — on laisse passer, la validation reelle se fait cote API
  return NextResponse.next();
}

export const config = {
  // Matcher large pour capturer `?token=` sur n'importe quelle page applicative,
  // tout en excluant les routes API (rewrites vers l'API) et les assets Next.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
