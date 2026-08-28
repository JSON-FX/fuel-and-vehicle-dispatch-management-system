import { createHash } from 'node:crypto';

import type { DispatchListQuery } from '@/application/dispatch/dto/dispatch-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export interface DispatchCursorPayload {
  readonly version: 1;
  readonly direction: 'next' | 'previous';
  readonly travelDate: string;
  readonly publicId: string;
  readonly filterFingerprint: string;
}

function fingerprint(query: DispatchListQuery): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        query: query.query,
        status: query.status,
        requestingOfficePublicId: query.requestingOfficePublicId,
        travelDateFrom: query.travelDateFrom,
        travelDateTo: query.travelDateTo,
        pageSize: query.pageSize,
      }),
      'utf8',
    )
    .digest('hex');
}

export class DispatchCursorCodec {
  encode(input: {
    readonly direction: 'next' | 'previous';
    readonly travelDate: string;
    readonly publicId: string;
    readonly query: DispatchListQuery;
  }): string {
    DispatchDate.from(input.travelDate);
    PublicId.from(input.publicId);
    const payload: DispatchCursorPayload = {
      version: 1,
      direction: input.direction,
      travelDate: input.travelDate,
      publicId: input.publicId,
      filterFingerprint: fingerprint(input.query),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  decode(cursor: string, query: DispatchListQuery): DispatchCursorPayload {
    if (cursor.length === 0 || cursor.length > 2_048) throw this.invalid();

    try {
      const text = Buffer.from(cursor, 'base64url').toString('utf8');
      if (Buffer.from(text, 'utf8').toString('base64url') !== cursor) {
        throw new Error('Invalid base64url.');
      }
      const candidate = JSON.parse(text) as Partial<DispatchCursorPayload>;
      if (
        candidate.version !== 1 ||
        (candidate.direction !== 'next' && candidate.direction !== 'previous') ||
        typeof candidate.travelDate !== 'string' ||
        typeof candidate.publicId !== 'string' ||
        candidate.filterFingerprint !== fingerprint(query)
      ) {
        throw new Error('Invalid dispatch cursor.');
      }
      DispatchDate.from(candidate.travelDate);
      PublicId.from(candidate.publicId);
      return candidate as DispatchCursorPayload;
    } catch {
      throw this.invalid();
    }
  }

  private invalid(): ValidationError {
    return new ValidationError([{ field: 'cursor', reason: 'Cursor is invalid or stale.' }]);
  }
}
