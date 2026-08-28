export interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: { readonly message?: string; readonly code?: string };
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.success || envelope.data === undefined) {
    throw new Error(envelope.error?.message ?? 'The request could not be completed.');
  }
  return envelope.data;
}

export function nextAuthenticationPath(next: string, returnTo: string): string {
  if (next === 'PASSWORD_CHANGE') return '/password-change';
  if (next === 'TOTP_ENROLLMENT') return '/mfa/enroll';
  if (next === 'TOTP_VERIFICATION') return '/mfa/challenge';
  return returnTo;
}
