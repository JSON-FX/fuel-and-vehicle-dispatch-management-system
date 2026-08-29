import { describe, expect, it } from 'vitest';

import { NodeExportDownloadTokenService } from '@/infrastructure/reporting/node-export-download-token-service';

describe('download token service', () => {
  it('issues random 32-byte raw tokens and deterministic SHA-256 hashes', () => {
    const service = new NodeExportDownloadTokenService();
    const first = service.issue();
    const second = service.issue();

    expect(Buffer.from(first.rawToken, 'base64url')).toHaveLength(32);
    expect(first.tokenHash).toHaveLength(32);
    expect(Buffer.from(service.hash(first.rawToken))).toEqual(Buffer.from(first.tokenHash));
    expect(second.rawToken).not.toBe(first.rawToken);
    expect(Buffer.from(second.tokenHash)).not.toEqual(Buffer.from(first.tokenHash));
  });
});
