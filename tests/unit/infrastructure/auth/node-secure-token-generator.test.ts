import { describe, expect, it } from 'vitest';

import { HmacRateLimitKey } from '@/infrastructure/auth/hmac-rate-limit-key';
import { NodeSecureTokenGenerator } from '@/infrastructure/auth/node-secure-token-generator';

describe('Node authentication key material', () => {
  it('generates 32-byte opaque tokens and deterministic SHA-256 hashes', () => {
    const generator = new NodeSecureTokenGenerator();
    const token = generator.generateToken();

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(generator.hashToken(token)).toHaveLength(32);
    expect(generator.hashToken(token)).toEqual(generator.hashToken(token));
  });

  it('generates a 24-character password from the unambiguous alphabet', () => {
    const password = new NodeSecureTokenGenerator().generateTemporaryPassword();

    expect(password).toHaveLength(24);
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]+$/);
  });

  it('domain-separates account and source rate-limit keys', () => {
    const key = Buffer.from('abcdef0123456789abcdef0123456789').toString('base64');
    const derive = new HmacRateLimitKey(key);

    expect(derive.forAccount('dispatch.officer')).toHaveLength(32);
    expect(derive.forAccount('dispatch.officer')).toEqual(derive.forAccount('dispatch.officer'));
    expect(derive.forAccount('dispatch.officer')).not.toEqual(derive.forSource('dispatch.officer'));
  });
});
