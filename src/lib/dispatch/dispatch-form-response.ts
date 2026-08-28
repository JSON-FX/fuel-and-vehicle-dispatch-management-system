import type { DispatchScheduleConflictContextDto } from '@/application/dispatch/dto/dispatch-dtos';

export interface DispatchApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly message?: string;
    readonly code?: string;
    readonly details?: readonly { readonly field?: string; readonly reason: string }[];
    readonly context?: unknown;
  };
}

export class DispatchApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Readonly<Record<string, string>>,
    readonly code: string | null = null,
    readonly conflictContext: DispatchScheduleConflictContextDto | null = null,
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
    envelope.error?.code ?? null,
    envelope.error?.code === 'DISPATCH_SCHEDULE_CONFLICT' &&
      isDispatchConflictContext(envelope.error.context)
      ? envelope.error.context
      : null,
  );
}

export async function getFreshDispatchCsrfToken(): Promise<string> {
  const response = await fetch('/api/me', { cache: 'no-store' });
  const current = await readDispatchApiResponse<{ readonly csrfToken: string }>(response);
  return current.csrfToken;
}

function isDispatchConflictContext(value: unknown): value is DispatchScheduleConflictContextDto {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.policy !== 'BLOCK' && candidate.policy !== 'WARN_AND_ACK') return false;
  if (typeof candidate.canOverride !== 'boolean') return false;
  if (typeof candidate.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.fingerprint)) {
    return false;
  }
  if (!Array.isArray(candidate.conflicts)) return false;
  return candidate.conflicts.every((conflict) => {
    if (typeof conflict !== 'object' || conflict === null) return false;
    const item = conflict as Record<string, unknown>;
    return (
      typeof item.dispatchPublicId === 'string' &&
      ['DRIVER', 'VEHICLE', 'DRIVER_AND_VEHICLE'].includes(String(item.conflictType)) &&
      typeof item.travelDate === 'string' &&
      typeof item.destination === 'string' &&
      typeof item.purpose === 'string' &&
      typeof item.driver === 'object' &&
      item.driver !== null &&
      typeof item.vehicle === 'object' &&
      item.vehicle !== null
    );
  });
}
