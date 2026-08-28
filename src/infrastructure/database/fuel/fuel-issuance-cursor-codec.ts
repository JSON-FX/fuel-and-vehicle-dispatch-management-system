import { createHash } from 'node:crypto';

import type { FuelIssuanceListQuery } from '@/application/fuel/dto/fuel-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export interface FuelIssuanceCursorPayload {
  readonly version: 1;
  readonly direction: 'next' | 'previous';
  readonly entryDate: string;
  readonly publicId: string;
  readonly filterFingerprint: string;
}

function fingerprint(query: FuelIssuanceListQuery): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        query: query.query,
        status: query.status,
        fuelType: query.fuelType,
        startDate: query.startDate,
        endDate: query.endDate,
        pageSize: query.pageSize,
      }),
      'utf8',
    )
    .digest('hex');
}

export class FuelIssuanceCursorCodec {
  encode(input: {
    readonly direction: 'next' | 'previous';
    readonly entryDate: string;
    readonly publicId: string;
    readonly query: FuelIssuanceListQuery;
  }): string {
    EntryDate.from(input.entryDate);
    PublicId.from(input.publicId);
    const payload: FuelIssuanceCursorPayload = {
      version: 1,
      direction: input.direction,
      entryDate: input.entryDate,
      publicId: input.publicId,
      filterFingerprint: fingerprint(input.query),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  decode(cursor: string, query: FuelIssuanceListQuery): FuelIssuanceCursorPayload {
    try {
      const candidate = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as Partial<FuelIssuanceCursorPayload>;
      if (
        candidate.version !== 1 ||
        (candidate.direction !== 'next' && candidate.direction !== 'previous') ||
        typeof candidate.entryDate !== 'string' ||
        typeof candidate.publicId !== 'string' ||
        candidate.filterFingerprint !== fingerprint(query)
      ) {
        throw new Error('Invalid fuel cursor.');
      }
      EntryDate.from(candidate.entryDate);
      PublicId.from(candidate.publicId);
      return candidate as FuelIssuanceCursorPayload;
    } catch {
      throw new ValidationError([{ field: 'cursor', reason: 'Cursor is invalid or stale.' }]);
    }
  }
}
