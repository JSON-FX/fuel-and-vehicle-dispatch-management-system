import { createHash } from 'node:crypto';

import type {
  CursorDirection,
  MasterDataListQuery,
  MasterDataResource,
} from '@/application/master-data/dto/master-data-list-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export interface MasterDataCursorPayload {
  readonly version: 1;
  readonly resource: MasterDataResource;
  readonly direction: CursorDirection;
  readonly sortValue: string;
  readonly publicId: string;
  readonly filterFingerprint: string;
}

function filterFingerprint(resource: MasterDataResource, query: MasterDataListQuery): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        resource,
        mode: query.mode,
        query: query.query,
        lifecycle: query.lifecycle,
        status: query.status,
        pageSize: query.pageSize,
      }),
      'utf8',
    )
    .digest('hex');
}

export class MasterDataCursorCodec {
  encode(input: {
    readonly resource: MasterDataResource;
    readonly direction: CursorDirection;
    readonly sortValue: string;
    readonly publicId: string;
    readonly query: MasterDataListQuery;
  }): string {
    PublicId.from(input.publicId);
    const payload: MasterDataCursorPayload = {
      version: 1,
      resource: input.resource,
      direction: input.direction,
      sortValue: input.sortValue,
      publicId: input.publicId,
      filterFingerprint: filterFingerprint(input.resource, input.query),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  decode(
    cursor: string,
    resource: MasterDataResource,
    query: MasterDataListQuery,
  ): MasterDataCursorPayload {
    if (cursor.length === 0 || cursor.length > 2_048) throw new ValidationError();
    let value: unknown;
    try {
      const text = Buffer.from(cursor, 'base64url').toString('utf8');
      if (Buffer.from(text, 'utf8').toString('base64url') !== cursor) {
        throw new Error('Invalid base64url.');
      }
      value = JSON.parse(text) as unknown;
    } catch {
      throw new ValidationError();
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError();
    }
    const candidate = value as Partial<MasterDataCursorPayload>;
    try {
      if (
        candidate.version !== 1 ||
        candidate.resource !== resource ||
        (candidate.direction !== 'next' && candidate.direction !== 'previous') ||
        typeof candidate.sortValue !== 'string' ||
        candidate.sortValue.length === 0 ||
        candidate.sortValue.length > 150 ||
        typeof candidate.publicId !== 'string' ||
        PublicId.from(candidate.publicId).toString() !== candidate.publicId ||
        candidate.filterFingerprint !== filterFingerprint(resource, query)
      ) {
        throw new Error('Invalid payload.');
      }
    } catch {
      throw new ValidationError();
    }
    return candidate as MasterDataCursorPayload;
  }
}
