import { createHash } from 'node:crypto';

import type { AuditSearchQuery } from '@/application/audit/dto/audit-event-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';

export type AuditCursorDirection = 'next' | 'previous';

interface AuditCursorPayload {
  readonly version: 1;
  readonly direction: AuditCursorDirection;
  readonly sequence: string;
  readonly filterFingerprint: string;
}

function filterFingerprint(query: AuditSearchQuery): string {
  const filters = {
    from: query.from,
    to: query.to,
    action: query.action,
    entityType: query.entityType,
    entityPublicId: query.entityPublicId,
    actorPublicId: query.actorPublicId,
    requestId: query.requestId,
  };
  return createHash('sha256').update(JSON.stringify(filters), 'utf8').digest('hex');
}

export class AuditCursorCodec {
  encode(direction: AuditCursorDirection, sequence: string, query: AuditSearchQuery): string {
    const payload: AuditCursorPayload = {
      version: 1,
      direction,
      sequence,
      filterFingerprint: filterFingerprint(query),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  decode(cursor: string, query: AuditSearchQuery): AuditCursorPayload {
    let value: unknown;
    try {
      const text = Buffer.from(cursor, 'base64url').toString('utf8');
      if (Buffer.from(text, 'utf8').toString('base64url') !== cursor)
        throw new Error('Invalid base64url.');
      value = JSON.parse(text) as unknown;
    } catch {
      throw new ValidationError();
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError();
    }
    const candidate = value as Partial<AuditCursorPayload>;
    if (
      candidate.version !== 1 ||
      (candidate.direction !== 'next' && candidate.direction !== 'previous') ||
      typeof candidate.sequence !== 'string' ||
      !/^[1-9]\d*$/.test(candidate.sequence) ||
      typeof candidate.filterFingerprint !== 'string' ||
      candidate.filterFingerprint !== filterFingerprint(query)
    ) {
      throw new ValidationError();
    }
    return candidate as AuditCursorPayload;
  }
}
