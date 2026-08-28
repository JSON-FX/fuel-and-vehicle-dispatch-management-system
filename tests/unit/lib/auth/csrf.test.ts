import { describe, expect, it } from 'vitest';

import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import { CsrfError, ValidationError } from '@/application/shared/errors/application-error';
import {
  assertJsonContentType,
  assertTrustedMutationOrigin,
  verifyCsrfToken,
} from '@/lib/auth/csrf';

const tokens: SecureTokenGenerator = {
  generateToken: () => 'unused',
  generateTemporaryPassword: () => 'unused',
  hashToken: (value) => new TextEncoder().encode(`hash:${value}`),
};

describe('CSRF and mutation request validation', () => {
  it('accepts a same-origin request with a matching synchronizer token', () => {
    const request = mutationRequest({
      origin: 'https://fvdms.lan',
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': 'expected',
    });

    expect(() => assertTrustedMutationOrigin(request, 'https://fvdms.lan')).not.toThrow();
    expect(() => verifyCsrfToken(request, tokens.hashToken('expected'), tokens)).not.toThrow();
  });

  it('uses an exact Referer origin only when Origin is absent', () => {
    const request = mutationRequest({ referer: 'https://fvdms.lan/admin/users' });

    expect(() => assertTrustedMutationOrigin(request, 'https://fvdms.lan')).not.toThrow();
  });

  it.each([
    { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    { referer: 'https://fvdms.lan.evil.example/admin' },
    {},
  ])('rejects an untrusted or unverifiable mutation origin', (headers) => {
    expect(() =>
      assertTrustedMutationOrigin(mutationRequest(headers), 'https://fvdms.lan'),
    ).toThrow(CsrfError);
  });

  it.each([undefined, '', 'wrong', 'expected-extra'])(
    'rejects missing, malformed, or mismatched synchronizer token %s',
    (csrfToken) => {
      const request = mutationRequest(csrfToken === undefined ? {} : { 'x-csrf-token': csrfToken });

      expect(() => verifyCsrfToken(request, tokens.hashToken('expected'), tokens)).toThrow(
        CsrfError,
      );
    },
  );

  it('requires JSON for mutation bodies and allows a charset parameter', () => {
    expect(() =>
      assertJsonContentType(mutationRequest({ 'content-type': 'application/json; charset=utf-8' })),
    ).not.toThrow();
    expect(() => assertJsonContentType(mutationRequest({ 'content-type': 'text/plain' }))).toThrow(
      ValidationError,
    );
  });
});

function mutationRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://fvdms.lan/api/users', { method: 'POST', headers });
}
