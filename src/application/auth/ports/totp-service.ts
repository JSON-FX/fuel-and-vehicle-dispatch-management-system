export interface TotpService {
  generateSecret(): string;
  createEnrollmentUri(secret: string, accountName: string, issuer: string): string;
  verify(secret: string, code: string, at: Date): number | null;
}

export interface QrCodeGenerator {
  toSvg(content: string): Promise<string>;
}
