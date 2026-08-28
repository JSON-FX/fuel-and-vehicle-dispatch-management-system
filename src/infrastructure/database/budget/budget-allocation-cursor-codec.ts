import { createHash } from 'node:crypto';

import type { CursorDirection } from '@/application/master-data/dto/master-data-list-dtos';
import type {
  BudgetAllocationListQuery,
  OperationalBudgetAllocationListQuery,
} from '@/application/budget/dto/budget-allocation-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export type BudgetCursorQuery = BudgetAllocationListQuery | OperationalBudgetAllocationListQuery;

export interface BudgetAllocationCursorPayload {
  readonly version: 1;
  readonly direction: CursorDirection;
  readonly fiscalYear: number;
  readonly quarter: number;
  readonly ppmpNumber: string;
  readonly publicId: string;
  readonly filterFingerprint: string;
}

function fingerprint(query: BudgetCursorQuery): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        query.mode === 'admin'
          ? {
              mode: query.mode,
              query: query.query,
              fiscalYear: query.fiscalYear,
              quarter: query.quarter,
              status: query.status,
              lifecycle: query.lifecycle,
              pageSize: query.pageSize,
            }
          : {
              mode: query.mode,
              query: query.query,
              effectiveDate: query.effectiveDate,
              fiscalYear: query.fiscalYear,
              quarter: query.quarter,
              pageSize: query.pageSize,
            },
      ),
      'utf8',
    )
    .digest('hex');
}

export class BudgetAllocationCursorCodec {
  encode(input: {
    readonly direction: CursorDirection;
    readonly fiscalYear: number;
    readonly quarter: number;
    readonly ppmpNumber: string;
    readonly publicId: string;
    readonly query: BudgetCursorQuery;
  }): string {
    PublicId.from(input.publicId);
    const payload: BudgetAllocationCursorPayload = {
      version: 1,
      direction: input.direction,
      fiscalYear: input.fiscalYear,
      quarter: input.quarter,
      ppmpNumber: input.ppmpNumber,
      publicId: input.publicId,
      filterFingerprint: fingerprint(input.query),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  decode(cursor: string, query: BudgetCursorQuery): BudgetAllocationCursorPayload {
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
    const candidate = value as Partial<BudgetAllocationCursorPayload>;
    try {
      if (
        candidate.version !== 1 ||
        (candidate.direction !== 'next' && candidate.direction !== 'previous') ||
        !Number.isInteger(candidate.fiscalYear) ||
        candidate.fiscalYear === undefined ||
        candidate.fiscalYear < 2000 ||
        candidate.fiscalYear > 9999 ||
        !Number.isInteger(candidate.quarter) ||
        candidate.quarter === undefined ||
        candidate.quarter < 1 ||
        candidate.quarter > 4 ||
        typeof candidate.ppmpNumber !== 'string' ||
        candidate.ppmpNumber.length < 1 ||
        candidate.ppmpNumber.length > 80 ||
        typeof candidate.publicId !== 'string' ||
        PublicId.from(candidate.publicId).toString() !== candidate.publicId ||
        candidate.filterFingerprint !== fingerprint(query)
      ) {
        throw new Error('Invalid payload.');
      }
    } catch {
      throw new ValidationError();
    }

    return candidate as BudgetAllocationCursorPayload;
  }
}
