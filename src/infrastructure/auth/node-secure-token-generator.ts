import { createHash, randomBytes, randomInt } from 'node:crypto';

import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';

const temporaryPasswordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export class NodeSecureTokenGenerator implements SecureTokenGenerator {
  generateToken(byteLength = 32): string {
    return randomBytes(byteLength).toString('base64url');
  }

  hashToken(token: string): Uint8Array {
    return createHash('sha256').update(token, 'utf8').digest();
  }

  generateTemporaryPassword(length = 24): string {
    let password = '';
    for (let index = 0; index < length; index += 1) {
      password += temporaryPasswordAlphabet[randomInt(temporaryPasswordAlphabet.length)];
    }
    return password;
  }
}
