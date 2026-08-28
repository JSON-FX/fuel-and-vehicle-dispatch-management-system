import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { EncryptedSecret, SecretEncryptor } from '@/application/auth/ports/secret-encryptor';

export class AesGcmSecretEncryptor implements SecretEncryptor {
  private readonly keys: ReadonlyMap<number, Buffer>;

  constructor(
    keyRing: Readonly<Record<string, string>>,
    private readonly activeKeyVersion: number,
  ) {
    this.keys = new Map(
      Object.entries(keyRing).map(([version, encodedKey]) => {
        const key = Buffer.from(encodedKey, 'base64');
        if (key.byteLength !== 32) throw new Error(`TOTP key ${version} must contain 32 bytes.`);
        return [Number(version), key] as const;
      }),
    );
    if (!this.keys.has(activeKeyVersion)) {
      throw new Error(`The active TOTP key version ${activeKeyVersion} is unavailable.`);
    }
  }

  encrypt(plaintext: string, additionalAuthenticatedData: string): EncryptedSecret {
    const key = this.keyFor(this.activeKeyVersion);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(additionalAuthenticatedData, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return {
      ciphertext,
      iv,
      authenticationTag: cipher.getAuthTag(),
      keyVersion: this.activeKeyVersion,
    };
  }

  decrypt(secret: EncryptedSecret, additionalAuthenticatedData: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.keyFor(secret.keyVersion), secret.iv, {
      authTagLength: 16,
    });
    decipher.setAAD(Buffer.from(additionalAuthenticatedData, 'utf8'));
    decipher.setAuthTag(secret.authenticationTag);
    return Buffer.concat([decipher.update(secret.ciphertext), decipher.final()]).toString('utf8');
  }

  private keyFor(version: number): Buffer {
    const key = this.keys.get(version);
    if (key === undefined) throw new Error(`TOTP key version ${version} is unavailable.`);
    return key;
  }
}
