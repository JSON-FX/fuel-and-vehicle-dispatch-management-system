import { z } from 'zod';

import type { BudgetAllocationListQuery } from '@/application/budget/dto/budget-allocation-dtos';
import type { OperationalBudgetAllocationQueryInput } from '@/application/budget/use-cases/list-operational-budget-allocations';
import { ValidationError } from '@/application/shared/errors/application-error';

const normalizedText = (minimum: number, maximum: number) =>
  z
    .string()
    .transform((value) => value.trim().replaceAll(/\s+/g, ' '))
    .pipe(z.string().min(minimum).max(maximum));
const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().trim().min(1).max(maximum).optional(),
  );
const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().min(minimum).max(maximum).optional(),
  );

function isValidCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const budgetAllocationPublicIdSchema = z
  .string()
  .uuid()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const ppmpNumberSchema = normalizedText(1, 80).transform((value) => value.toUpperCase());
const quarterSchema = z.number().int().min(1).max(4);
const fiscalYearSchema = z.number().int().min(2000).max(9999);

export const createBudgetAllocationSchema = z
  .object({
    ppmpNumber: ppmpNumberSchema,
    officePublicId: budgetAllocationPublicIdSchema,
    quarter: quarterSchema,
    fiscalYear: fiscalYearSchema,
  })
  .strict();

const updateBudgetAllocationSchema = z
  .object({
    action: z.literal('update'),
    ppmpNumber: ppmpNumberSchema.optional(),
    officePublicId: budgetAllocationPublicIdSchema.optional(),
    quarter: quarterSchema.optional(),
    fiscalYear: fiscalYearSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'action'), {
    message: 'Provide at least one draft field to update.',
    path: ['action'],
  });
const activateBudgetAllocationSchema = z.object({ action: z.literal('activate') }).strict();
const closeBudgetAllocationSchema = z.object({ action: z.literal('close') }).strict();
const cancelBudgetAllocationSchema = z
  .object({ action: z.literal('cancel'), reason: normalizedText(10, 500) })
  .strict();

export const patchBudgetAllocationSchema = z.discriminatedUnion('action', [
  updateBudgetAllocationSchema,
  activateBudgetAllocationSchema,
  closeBudgetAllocationSchema,
  cancelBudgetAllocationSchema,
]);
export const budgetAllocationReasonSchema = z.object({ reason: normalizedText(10, 500) }).strict();
export const emptyBudgetAllocationBodySchema = z.object({}).strict();

const pageFields = {
  query: optionalText(150),
  cursor: optionalText(2_048),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
};
const adminListSchema = z
  .object({
    mode: z.literal('admin'),
    ...pageFields,
    fiscalYear: optionalInteger(2000, 9999),
    quarter: optionalInteger(1, 4),
    status: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED']).optional(),
    ),
    lifecycle: z.enum(['current', 'deleted', 'all']).default('current'),
  })
  .strict();
const effectiveDateSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .refine(isValidCivilDate, 'Provide a valid calendar date in YYYY-MM-DD format.')
    .optional(),
);
const operationalListSchema = z
  .object({
    mode: z.literal('operational'),
    ...pageFields,
    effectiveDate: effectiveDateSchema,
  })
  .strict();
const budgetAllocationListQuerySchema = z.preprocess(
  (value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    const input = value as Record<string, unknown>;
    return { ...input, mode: input.mode === undefined || input.mode === '' ? 'admin' : input.mode };
  },
  z.discriminatedUnion('mode', [adminListSchema, operationalListSchema]),
);

export function parseBudgetAllocationListQuery(
  input: unknown,
): BudgetAllocationListQuery | OperationalBudgetAllocationQueryInput {
  const parsed = budgetAllocationListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => ({
        ...(issue.path.length === 0 ? {} : { field: String(issue.path[0]) }),
        reason: issue.message,
      })),
    );
  }

  if (parsed.data.mode === 'admin') {
    return {
      mode: 'admin',
      query: parsed.data.query ?? null,
      fiscalYear: parsed.data.fiscalYear ?? null,
      quarter: parsed.data.quarter ?? null,
      status: parsed.data.status ?? null,
      lifecycle: parsed.data.lifecycle,
      cursor: parsed.data.cursor ?? null,
      pageSize: parsed.data.pageSize,
    };
  }
  return {
    mode: 'operational',
    query: parsed.data.query ?? null,
    effectiveDate: parsed.data.effectiveDate ?? null,
    cursor: parsed.data.cursor ?? null,
    pageSize: parsed.data.pageSize,
  };
}

export function budgetListSearchParams(searchParams: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}
