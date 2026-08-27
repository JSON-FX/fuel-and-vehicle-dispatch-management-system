import { ZodError } from 'zod';

import { ApplicationError, ValidationError } from '@/application/shared/errors/application-error';
import type { Logger } from '@/application/shared/ports/logger';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { createErrorResponse, createSuccessResponse } from '@/lib/http/api-response';
import { resolveRequestId } from '@/lib/http/request-id';

export interface ApiHandlerDependencies {
  readonly logger: Logger;
  readonly publicIdGenerator: PublicIdGenerator;
}

export interface ApiHandlerContext {
  readonly request: Request;
  readonly requestId: string;
}

export interface ApiHandlerOptions {
  readonly status?: number;
  readonly headers?: HeadersInit;
}

export function withApiHandler<T>(
  dependencies: ApiHandlerDependencies,
  handler: (context: ApiHandlerContext) => Promise<T>,
  options: ApiHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const requestId = resolveRequestId(
      request.headers.get('x-request-id'),
      dependencies.publicIdGenerator,
    );
    const startedAt = performance.now();
    let status = options.status ?? 200;

    try {
      const data = await handler({ request, requestId });
      return createSuccessResponse(data, requestId, responseInit(status, options.headers));
    } catch (caughtError) {
      const error = normalizeError(caughtError);
      status = error.httpStatus;
      dependencies.logger.error('http.request.failed', caughtError, {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status,
      });

      return createErrorResponse(error, requestId, responseInit(status, options.headers));
    } finally {
      dependencies.logger.info('http.request.completed', {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  };
}

function responseInit(status: number, headers: HeadersInit | undefined): ResponseInit {
  return headers === undefined ? { status } : { status, headers };
}

function normalizeError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationError(
      error.issues.map((issue) => ({
        field: issue.path.join('.'),
        reason: issue.message,
      })),
    );
  }

  return new InternalError(error);
}

class InternalError extends ApplicationError {
  constructor(cause: unknown) {
    super('INTERNAL_ERROR', 'An unexpected error occurred.', 500, [], cause);
  }
}
