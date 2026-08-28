export interface EncryptedSecret {
  readonly ciphertext: Uint8Array;
  readonly iv: Uint8Array;
  readonly authenticationTag: Uint8Array;
  readonly keyVersion: number;
}

export interface SecretEncryptor {
  encrypt(plaintext: string, additionalAuthenticatedData: string): EncryptedSecret;
  decrypt(secret: EncryptedSecret, additionalAuthenticatedData: string): string;
}
