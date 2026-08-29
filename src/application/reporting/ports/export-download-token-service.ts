export interface ExportDownloadToken {
  readonly rawToken: string;
  readonly tokenHash: Uint8Array;
}

export interface ExportDownloadTokenService {
  issue(): ExportDownloadToken;
  hash(rawToken: string): Uint8Array;
}
