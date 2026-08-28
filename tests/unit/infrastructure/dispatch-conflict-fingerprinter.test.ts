import { describe, expect, it } from 'vitest';

import type { DispatchConflictFingerprintInputDto } from '@/application/dispatch/dto/dispatch-dtos';
import { NodeSha256DispatchConflictFingerprinter } from '@/infrastructure/dispatch/node-sha256-dispatch-conflict-fingerprinter';

const input: DispatchConflictFingerprintInputDto = {
  schemaVersion: 1,
  policy: 'WARN_AND_ACK',
  settingsUpdatedAt: '2026-08-29T00:00:00.000Z',
  candidate: {
    travelDate: '2026-08-30',
    driverPublicId: '01900000-0000-7000-8000-000000000721',
    vehiclePublicId: '01900000-0000-7000-8000-000000000731',
    excludedDispatchPublicId: null,
  },
  conflicts: [
    {
      dispatchPublicId: '01900000-0000-7000-8000-000000000741',
      conflictType: 'DRIVER',
    },
    {
      dispatchPublicId: '01900000-0000-7000-8000-000000000742',
      conflictType: 'VEHICLE',
    },
  ],
};

describe('NodeSha256DispatchConflictFingerprinter', () => {
  it('hashes the versioned canonical conflict snapshot as lowercase SHA-256', () => {
    const fingerprinter = new NodeSha256DispatchConflictFingerprinter();

    expect(fingerprinter.create(input)).toBe(
      'a85125bea9a143d535323c042bbe281c33cf217a9282f9c53310202dc8beb4c0',
    );
  });

  it('sorts conflict pairs before hashing and changes when the policy changes', () => {
    const fingerprinter = new NodeSha256DispatchConflictFingerprinter();
    const reversed = { ...input, conflicts: [...input.conflicts].reverse() };

    expect(fingerprinter.create(reversed)).toBe(fingerprinter.create(input));
    expect(fingerprinter.create({ ...input, policy: 'BLOCK' })).not.toBe(
      fingerprinter.create(input),
    );
  });
});
