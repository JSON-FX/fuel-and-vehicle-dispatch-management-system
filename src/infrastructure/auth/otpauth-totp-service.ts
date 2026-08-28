import * as OTPAuth from 'otpauth';

import type { TotpService } from '@/application/auth/ports/totp-service';

const period = 30;

export class OtpAuthTotpService implements TotpService {
  generateSecret(): string {
    return new OTPAuth.Secret({ size: 20 }).base32;
  }

  createEnrollmentUri(secret: string, accountName: string, issuer: string): string {
    return new OTPAuth.TOTP({
      issuer,
      label: accountName,
      issuerInLabel: true,
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period,
    }).toString();
  }

  verify(secret: string, code: string, at: Date): number | null {
    if (!/^\d{6}$/.test(code)) return null;

    const timestamp = at.getTime();
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period,
    });
    const delta = totp.validate({ token: code, timestamp, window: 1 });
    return delta === null ? null : totp.counter({ timestamp }) + delta;
  }
}
