export interface SecureTokenGenerator {
  generateToken(byteLength?: number): string;
  hashToken(token: string): Uint8Array;
  generateTemporaryPassword(length?: number): string;
}
