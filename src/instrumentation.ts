import type { Instrumentation } from 'next';

import { parseBuildEnvironment } from '@/infrastructure/config/environment';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';
import { createPinoLogger } from '@/infrastructure/logging/pino-logger';
import { resolveRequestId } from '@/lib/http/request-id';

function logger() {
  const configuration = parseBuildEnvironment(process.env);
  return createPinoLogger({ level: configuration.logLevel });
}

export function register(): void {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    logger().info('application.started', { runtime: 'nodejs' });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const requestHeader = request.headers['x-request-id'];
  const incomingRequestId = Array.isArray(requestHeader) ? requestHeader[0] : requestHeader;
  const requestId = resolveRequestId(incomingRequestId ?? null, new UuidV7Generator());

  logger().error('http.request.uncaught', error, {
    requestId,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
