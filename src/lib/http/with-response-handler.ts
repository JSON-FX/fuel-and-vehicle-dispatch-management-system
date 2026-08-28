import { ZodError } from 'zod';

import { ApplicationError, ValidationError } from '@/application/shared/errors/application-error';
import type { Logger } from '@/application/shared/ports/logger';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { createErrorResponse, createSuccessResponse } from '@/lib/http/api-response';
import { resolveRequestId } from '@/lib/http/request-id';

export interface ResponseHandlerDependencies {
  readonly logger: Logger;
  readonly publicIdGenerator: PublicIdGenerator;
}

export interface ResponseHandlerContext {
  readonly request: Request;
  readonly requestId: string;
}

export interface ResponseHandlerOptions {
  readonly status?: number;
  readonly headers?: HeadersInit;
}

export function withResponseHandler<T>(
  dependencies: ResponseHandlerDependencies,
  handler: (context: ResponseHandlerContext) => Promise<T | Response>,
  options: ResponseHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const requestId = resolveRequestId(
      request.headers.get('x-request-id'),
      dependencies.publicIdGenerator,
    );
    const startedAt = performance.now();
    let status = options.status ?? 200;

    try {
      const result = await handler({ request, requestId });
      if (result instanceof Response) {
        status = result.status;
        return secureResponse(result, requestId);
      }

      return createSuccessResponse(result, requestId, {
        status,
        headers: secureHeaders(options.headers, requestId),
      });
    } catch (caughtError) {
      const error = normalizeError(caughtError);
      status = error.httpStatus;
      dependencies.logger.error('http.request.failed', caughtError, {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status,
      });

      return createErrorResponse(error, requestId, {
        status,
        headers: secureHeaders(options.headers, requestId),
      });
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

function secureResponse(response: Response, requestId: string): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: secureHeaders(response.headers, requestId),
  });
}

function secureHeaders(headers: HeadersInit | undefined, requestId: string): Headers {
  const secured = new Headers(headers);
  secured.set('cache-control', 'no-store');
  secured.set('x-request-id', requestId);
  return secured;
}

function normalizeError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) return error;
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
