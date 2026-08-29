import { createHash, randomBytes } from 'node:crypto';

import type {
  ExportDownloadToken,
  ExportDownloadTokenService,
} from '@/application/reporting/ports/export-download-token-service';

export class NodeExportDownloadTokenService implements ExportDownloadTokenService {
  issue(): ExportDownloadToken {
    const bytes = randomBytes(32);
    return {
      rawToken: bytes.toString('base64url'),
      tokenHash: hash(bytes),
    };
  }

  hash(rawToken: string): Uint8Array {
    if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return hash(Buffer.from(rawToken, 'utf8'));
    return hash(Buffer.from(rawToken, 'base64url'));
  }
}

function hash(value: Uint8Array): Uint8Array {
  return createHash('sha256').update(value).digest();
}
