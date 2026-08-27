import type { ErrorDetail } from '@/application/shared/errors/application-error';

export interface ApiSuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
  readonly requestId: string;
}

export interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: readonly ErrorDetail[];
  };
  readonly requestId: string;
}

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('x-request-id', requestId);

  return Response.json({ success: true, data, requestId }, { ...init, headers });
}

export function createErrorResponse(
  error: { code: string; message: string; details?: readonly ErrorDetail[] },
  requestId: string,
  init: ResponseInit,
): Response {
  const headers = new Headers(init.headers);
  headers.set('x-request-id', requestId);

  return Response.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? [],
      },
      requestId,
    },
    { ...init, headers },
  );
}
