import { describe, expect, it } from 'vitest';

import { AesGcmSecretEncryptor } from '@/infrastructure/auth/aes-gcm-secret-encryptor';

const keyOne = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
const keyTwo = Buffer.from('abcdef0123456789abcdef0123456789').toString('base64');

describe('AesGcmSecretEncryptor', () => {
  it('round-trips a secret with random IVs and authenticated context', () => {
    const encryptor = new AesGcmSecretEncryptor({ 1: keyOne, 2: keyTwo }, 2);
    const first = encryptor.encrypt('JBSWY3DPEHPK3PXP', 'user:factor');
    const second = encryptor.encrypt('JBSWY3DPEHPK3PXP', 'user:factor');

    expect(first.keyVersion).toBe(2);
    expect(first.iv).toHaveLength(12);
    expect(first.authenticationTag).toHaveLength(16);
    expect(first.iv).not.toEqual(second.iv);
    expect(encryptor.decrypt(first, 'user:factor')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('decrypts old key versions but rejects tampering and wrong context', () => {
    const oldEncryptor = new AesGcmSecretEncryptor({ 1: keyOne }, 1);
    const encrypted = oldEncryptor.encrypt('old-secret', 'user:factor');
    const rotatingEncryptor = new AesGcmSecretEncryptor({ 1: keyOne, 2: keyTwo }, 2);

    expect(rotatingEncryptor.decrypt(encrypted, 'user:factor')).toBe('old-secret');
    expect(() => rotatingEncryptor.decrypt(encrypted, 'another:factor')).toThrow();

    const tampered = {
      ...encrypted,
      ciphertext: Uint8Array.from(encrypted.ciphertext, (value, index) =>
        index === 0 ? value ^ 1 : value,
      ),
    };
    expect(() => rotatingEncryptor.decrypt(tampered, 'user:factor')).toThrow();
  });
});
