import { type NextRequest, NextResponse } from 'next/server';

import { parseBuildEnvironment } from '@/infrastructure/config/environment';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';
import { createPinoLogger } from '@/infrastructure/logging/pino-logger';
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

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)'],
};
