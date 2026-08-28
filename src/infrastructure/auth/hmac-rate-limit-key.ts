import { createHmac } from 'node:crypto';

import type { RateLimitKeyGenerator } from '@/application/auth/ports/rate-limit-repository';

export class HmacRateLimitKey implements RateLimitKeyGenerator {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.byteLength !== 32) {
      throw new Error('A 32-byte rate-limit HMAC key is required.');
    }
  }

  forAccount(normalizedUsername: string): Uint8Array {
    return this.derive('account', normalizedUsername);
  }

  forSource(sourceAddress: string): Uint8Array {
    return this.derive('source', sourceAddress);
  }

  forTotp(challengePublicId: string): Uint8Array {
    return this.derive('totp', challengePublicId);
  }

  private derive(domain: string, value: string): Uint8Array {
    return createHmac('sha256', this.key).update(domain).update('\0').update(value).digest();
  }
}
