import type { CursorDirection } from '@/application/master-data/dto/master-data-list-dtos';
import { ConflictError } from '@/application/shared/errors/application-error';

export function escapeLikeLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

export function keysetOperator(direction: CursorDirection): '>' | '<' {
  return direction === 'next' ? '>' : '<';
}

export function normalizeKeysetPage<T>(
  items: readonly T[],
  direction: CursorDirection,
): readonly T[] {
  return direction === 'previous' ? [...items].reverse() : items;
}

const duplicateFields: Readonly<Record<string, string>> = {
  uq_offices_office_name: 'name',
  uq_offices_abbreviation: 'abbreviation',
  uq_vehicles_plate_no: 'plateNumber',
};

export function mapDuplicateConstraint(error: unknown): never {
  const candidate = error as { code?: unknown; message?: unknown; sqlMessage?: unknown };
  if (candidate.code !== 'ER_DUP_ENTRY') throw error;
  const message = `${String(candidate.message ?? '')} ${String(candidate.sqlMessage ?? '')}`;
  const match = Object.entries(duplicateFields).find(([constraint]) =>
    message.includes(constraint),
  );
  if (match === undefined) throw new ConflictError('A unique master-data value already exists.');
  throw new ConflictError('A unique master-data value already exists.', [
    { field: match[1], reason: 'This value is already in use.' },
  ]);
}
