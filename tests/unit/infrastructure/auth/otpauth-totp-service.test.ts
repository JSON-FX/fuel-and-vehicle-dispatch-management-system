import * as OTPAuth from 'otpauth';
import { describe, expect, it } from 'vitest';

import { OtpAuthTotpService } from '@/infrastructure/auth/otpauth-totp-service';

describe('OtpAuthTotpService', () => {
  const service = new OtpAuthTotpService();
  const at = new Date('2026-08-28T00:00:00.000Z');

  it('generates a 20-byte secret and an interoperable enrollment URI', () => {
    const secret = service.generateSecret();
    const uri = service.createEnrollmentUri(secret, 'system.admin', 'FVDMS');

    expect(OTPAuth.Secret.fromBase32(secret).bytes).toHaveLength(20);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('accepts six-digit codes within one counter and returns the accepted counter', () => {
    const secret = OTPAuth.Secret.fromUTF8('12345678901234567890').base32;
    const totp = new OTPAuth.TOTP({ secret, algorithm: 'SHA1', digits: 6, period: 30 });
    const previousCode = totp.generate({ timestamp: at.getTime() - 30_000 });

    expect(service.verify(secret, previousCode, at)).toBe(
      OTPAuth.TOTP.counter({ timestamp: at.getTime(), period: 30 }) - 1,
    );
    expect(service.verify(secret, '12345', at)).toBeNull();
    expect(service.verify(secret, 'abcdef', at)).toBeNull();
  });
});
