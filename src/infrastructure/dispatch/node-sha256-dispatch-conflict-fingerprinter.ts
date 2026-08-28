import { createHash } from 'node:crypto';

import type { DispatchConflictFingerprintInputDto } from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchConflictFingerprintPort } from '@/application/dispatch/ports/dispatch-conflict-fingerprint-port';

export class NodeSha256DispatchConflictFingerprinter implements DispatchConflictFingerprintPort {
  create(input: DispatchConflictFingerprintInputDto): string {
    const conflicts = [...input.conflicts]
      .map((conflict) => ({
        dispatchPublicId: conflict.dispatchPublicId,
        conflictType: conflict.conflictType,
      }))
      .sort((left, right) =>
        left.dispatchPublicId === right.dispatchPublicId
          ? left.conflictType.localeCompare(right.conflictType)
          : left.dispatchPublicId.localeCompare(right.dispatchPublicId),
      );
    const canonical = JSON.stringify({
      schemaVersion: input.schemaVersion,
      policy: input.policy,
      settingsUpdatedAt: input.settingsUpdatedAt,
      candidate: {
        travelDate: input.candidate.travelDate,
        driverPublicId: input.candidate.driverPublicId,
        vehiclePublicId: input.candidate.vehiclePublicId,
        excludedDispatchPublicId: input.candidate.excludedDispatchPublicId,
      },
      conflicts,
    });

    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
}
