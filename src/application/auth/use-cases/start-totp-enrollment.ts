import type { TotpEnrollmentResult } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import type { QrCodeGenerator, TotpService } from '@/application/auth/ports/totp-service';
import type { SecretEncryptor } from '@/application/auth/ports/secret-encryptor';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class StartTotpEnrollment {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly totp: TotpService;
      readonly encryptor: SecretEncryptor;
      readonly qrCode: QrCodeGenerator;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
      readonly issuer: string;
    },
  ) {}

  async execute(input: {
    readonly userPublicId: string;
    readonly username: string;
  }): Promise<TotpEnrollmentResult> {
    const factorPublicId = this.dependencies.publicIds.generate().toString();
    const manualSecret = this.dependencies.totp.generateSecret();
    const enrollmentUri = this.dependencies.totp.createEnrollmentUri(
      manualSecret,
      input.username,
      this.dependencies.issuer,
    );
    const encryptedSecret = this.dependencies.encryptor.encrypt(
      manualSecret,
      `${input.userPublicId}:${factorPublicId}`,
    );
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(({ totpFactors }) =>
      totpFactors.save({
        publicId: factorPublicId,
        userPublicId: input.userPublicId,
        status: 'PENDING',
        encryptedSecret,
        lastUsedCounter: null,
        confirmedAt: null,
        createdAt: at,
        updatedAt: at,
      }),
    );

    return {
      factorPublicId,
      manualSecret,
      enrollmentUri,
      qrSvg: await this.dependencies.qrCode.toSvg(enrollmentUri),
    };
  }
}
