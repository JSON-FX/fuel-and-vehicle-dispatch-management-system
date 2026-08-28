import argon2 from 'argon2';
import { describe, expect, it } from 'vitest';

import { Argon2PasswordHasher } from '@/infrastructure/auth/argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes and verifies with the accepted Argon2id floor', async () => {
    const encoded = await hasher.hash('correct horse battery staple');

    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    await expect(hasher.verify(encoded, 'correct horse battery staple')).resolves.toBe(true);
    await expect(hasher.verify(encoded, 'wrong password')).resolves.toBe(false);
  });

  it('identifies an encoded hash below the current cost', async () => {
    const weaker = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
      memoryCost: 8_192,
      timeCost: 1,
      parallelism: 1,
    });

    expect(hasher.needsRehash(weaker)).toBe(true);
  });
});
