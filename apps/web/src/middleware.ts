import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/admin', '/formateur'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  // Le token JWT est stocke dans un cookie httpOnly "token"
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
  matcher: ['/admin/:path*', '/formateur/:path*'],
};
