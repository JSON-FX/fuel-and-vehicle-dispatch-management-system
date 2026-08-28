import { timingSafeEqual } from 'node:crypto';

import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import { CsrfError, ValidationError } from '@/application/shared/errors/application-error';

export function assertTrustedMutationOrigin(request: Request, allowedOrigin: string): void {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new CsrfError();

  const origin = request.headers.get('origin');
  if (origin !== null) {
    if (origin !== allowedOrigin) throw new CsrfError();
    return;
  }

  const referer = request.headers.get('referer');
  if (referer === null || originOf(referer) !== allowedOrigin) throw new CsrfError();
}

export function verifyCsrfToken(
  request: Request,
  expectedTokenHash: Uint8Array,
  tokenGenerator: Pick<SecureTokenGenerator, 'hashToken'>,
): void {
  const submittedToken = request.headers.get('x-csrf-token');
  if (submittedToken === null || submittedToken === '') throw new CsrfError();

  const submittedHash = tokenGenerator.hashToken(submittedToken);
  if (
    submittedHash.byteLength !== expectedTokenHash.byteLength ||
    !timingSafeEqual(submittedHash, expectedTokenHash)
  ) {
    throw new CsrfError();
  }
}

export function assertJsonContentType(request: Request): void {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new ValidationError([
      { field: 'content-type', reason: 'The request body must use application/json.' },
    ]);
  }
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
