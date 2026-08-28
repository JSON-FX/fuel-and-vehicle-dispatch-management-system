export interface MasterDataApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly message?: string;
    readonly code?: string;
    readonly details?: readonly { readonly field?: string; readonly reason: string }[];
  };
}

export class MasterDataApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = 'MasterDataApiError';
  }
}

export async function readMasterDataApiResponse<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as MasterDataApiEnvelope<T>;
  if (response.ok && envelope.success && envelope.data !== undefined) return envelope.data;
  const fieldErrors = Object.fromEntries(
    (envelope.error?.details ?? [])
      .filter((detail): detail is { field: string; reason: string } => detail.field !== undefined)
      .map((detail) => [detail.field, detail.reason]),
  );
  throw new MasterDataApiError(
    envelope.error?.message ?? 'The request could not be completed.',
    fieldErrors,
  );
}
