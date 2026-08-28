import argon2 from 'argon2';

import type { PasswordHasher } from '@/application/auth/ports/password-hasher';

const options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, options);
  }

  async verify(encodedHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(encodedHash, password);
    } catch {
      return false;
    }
  }

  needsRehash(encodedHash: string): boolean {
    try {
      return argon2.needsRehash(encodedHash, options);
    } catch {
      return true;
    }
  }
}
