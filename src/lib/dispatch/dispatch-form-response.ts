export interface DispatchApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly message?: string;
    readonly code?: string;
    readonly details?: readonly { readonly field?: string; readonly reason: string }[];
  };
}

export class DispatchApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = 'DispatchApiError';
  }
}

export async function readDispatchApiResponse<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as DispatchApiEnvelope<T>;
  if (response.ok && envelope.success && envelope.data !== undefined) return envelope.data;
  const fieldErrors = Object.fromEntries(
    (envelope.error?.details ?? [])
      .filter((detail): detail is { field: string; reason: string } => detail.field !== undefined)
      .map((detail) => [detail.field, detail.reason]),
  );
  throw new DispatchApiError(
    envelope.error?.message ?? 'The request could not be completed.',
    fieldErrors,
  );
}

export async function getFreshDispatchCsrfToken(): Promise<string> {
  const response = await fetch('/api/me', { cache: 'no-store' });
  const current = await readDispatchApiResponse<{ readonly csrfToken: string }>(response);
  return current.csrfToken;
}
