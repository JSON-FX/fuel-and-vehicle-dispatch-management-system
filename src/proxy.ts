import { type NextRequest, NextResponse } from 'next/server';

import { parseBuildEnvironment } from '@/infrastructure/config/environment';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';
import { createPinoLogger } from '@/infrastructure/logging/pino-logger';
import { AUTH_SESSION_COOKIE, deleteAuthCookie } from '@/lib/auth/cookies';
import { resolveRequestId } from '@/lib/http/request-id';

export function proxy(request: NextRequest): NextResponse {
  const configuration = parseBuildEnvironment(process.env);
  const logger = createPinoLogger({ level: configuration.logLevel });
  const requestId = resolveRequestId(request.headers.get('x-request-id'), new UuidV7Generator());
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('x-request-id', requestId);

  logger.info('http.request.received', {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
  });

  const response = routeRequest(request, forwardedHeaders);
  response.headers.set('x-request-id', requestId);
  return response;
}

const authenticationPages = new Set([
  '/login',
  '/password-change',
  '/mfa/enroll',
  '/mfa/challenge',
]);

const challengePages = new Set(['/password-change', '/mfa/enroll', '/mfa/challenge']);

function routeRequest(request: NextRequest, forwardedHeaders: Headers): NextResponse {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  const hasSession = request.cookies.has(AUTH_SESSION_COOKIE);
  const hasChallenge = request.cookies.has('__Host-fvdms_challenge');

  if (pathname === '/login' && request.nextUrl.searchParams.get('invalidSession') === '1') {
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    const expired = deleteAuthCookie(AUTH_SESSION_COOKIE);
    response.cookies.set(expired.name, expired.value, expired.options);
    return response;
  }

  if (hasSession && authenticationPages.has(pathname)) {
    return redirect(
      request,
      safeReturnTo(request.nextUrl.searchParams.get('returnTo')) ?? '/account',
    );
  }

  if (challengePages.has(pathname) && !hasChallenge) {
    return redirect(request, '/login');
  }

  if (!authenticationPages.has(pathname) && !hasSession) {
    if (hasChallenge) return redirect(request, '/login');
    const returnTo = `${pathname}${request.nextUrl.search}`;
    const target = new URL('/login', request.url);
    target.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(target);
  }

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

function redirect(request: NextRequest, pathname: string): NextResponse {
  return NextResponse.redirect(new URL(pathname, request.url));
}

function safeReturnTo(value: string | null): string | null {
  if (value === null || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, 'https://fvdms.lan');
    return parsed.origin === 'https://fvdms.lan' ? `${parsed.pathname}${parsed.search}` : null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)'],
};
