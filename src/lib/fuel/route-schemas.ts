import { z } from 'zod';

import type { FuelBalanceQuery, FuelIssuanceListQuery } from '@/application/fuel/dto/fuel-dtos';
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
const optionalStatus = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['DRAFT', 'POSTED', 'VOIDED']).optional(),
);
const optionalFuelType = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['DIESEL', 'GASOLINE']).optional(),
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

const civilDateSchema = z
  .string()
  .refine(isValidCivilDate, 'Provide a valid calendar date in YYYY-MM-DD format.');
const quantitySchema = z
  .string()
  .regex(
    /^(?:0*[1-9]\d*|0*\.\d*[1-9]\d*)$|^(?:\d+\.\d{1,3})$/,
    'Provide a positive decimal with up to three places.',
  )
  .refine((value) => /^\d+(?:\.\d{1,3})?$/.test(value) && !/^0+(?:\.0+)?$/.test(value), {
    message: 'Provide a positive decimal with up to three places.',
  });
const priceSchema = z
  .string()
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value) && !/^0+(?:\.0+)?$/.test(value), {
    message: 'Provide a positive decimal with up to two places.',
  });

export const fuelPublicIdSchema = z
  .string()
  .uuid()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const draftFields = {
  purchaseRequestNumber: normalizedText(1, 80).transform((value) => value.toUpperCase()),
  entryDate: civilDateSchema,
  driverPublicId: fuelPublicIdSchema,
  destination: normalizedText(1, 255).optional(),
  purpose: normalizedText(1, 1_000),
  vehiclePublicId: fuelPublicIdSchema,
  requestedLiters: quantitySchema.nullable(),
  isFullTank: z.boolean(),
  issuedLiters: quantitySchema.nullable().optional(),
  unitPrice: priceSchema,
  budgetAllocationPublicId: fuelPublicIdSchema,
  fuelType: z.enum(['DIESEL', 'GASOLINE']),
};

function draftSchema() {
  return z
    .object(draftFields)
    .strict()
    .superRefine((value, context) => {
      if (value.isFullTank && value.requestedLiters !== null) {
        context.addIssue({
          code: 'custom',
          path: ['requestedLiters'],
          message: 'Full-tank drafts cannot have requested liters.',
        });
      }
      if (!value.isFullTank && value.requestedLiters === null) {
        context.addIssue({
          code: 'custom',
          path: ['requestedLiters'],
          message: 'Standard drafts require requested liters.',
        });
      }
    });
}

export const createFuelIssuanceSchema = draftSchema();
export const updateFuelIssuanceSchema = draftSchema();
export const postFuelIssuanceSchema = z.object({ issuedLiters: quantitySchema }).strict();
export const voidFuelIssuanceSchema = z.object({ reason: normalizedText(10, 500) }).strict();

const listSchema = z
  .object({
    query: optionalText(150),
    status: optionalStatus,
    fuelType: optionalFuelType,
    startDate: z.preprocess(
      (value) => (value === '' ? undefined : value),
      civilDateSchema.optional(),
    ),
    endDate: z.preprocess(
      (value) => (value === '' ? undefined : value),
      civilDateSchema.optional(),
    ),
    cursor: optionalText(2_048),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

const balanceSchema = z
  .object({
    startDate: civilDateSchema,
    endDate: civilDateSchema,
    fuelType: optionalFuelType,
  })
  .strict()
  .refine((value) => value.startDate <= value.endDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date.',
  });
const preparationOptionsSchema = z.object({ entryDate: civilDateSchema }).strict();

export function parseFuelIssuanceListQuery(input: unknown): FuelIssuanceListQuery {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) throwValidation(parsed.error);
  return {
    query: parsed.data.query ?? null,
    status: parsed.data.status ?? null,
    fuelType: parsed.data.fuelType ?? null,
    startDate: parsed.data.startDate ?? null,
    endDate: parsed.data.endDate ?? null,
    cursor: parsed.data.cursor ?? null,
    pageSize: parsed.data.pageSize,
  };
}

export function parseFuelBalanceQuery(input: unknown): FuelBalanceQuery {
  const parsed = balanceSchema.safeParse(input);
  if (!parsed.success) throwValidation(parsed.error);
  return {
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    fuelType: parsed.data.fuelType ?? null,
  };
}

export function parseFuelPreparationOptionsQuery(input: unknown): string {
  const parsed = preparationOptionsSchema.safeParse(input);
  if (!parsed.success) throwValidation(parsed.error);
  return parsed.data.entryDate;
}

export function fuelSearchParams(searchParams: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}

function throwValidation(error: z.ZodError): never {
  throw new ValidationError(
    error.issues.map((issue) => ({
      ...(issue.path.length === 0 ? {} : { field: String(issue.path[0]) }),
      reason: issue.message,
    })),
  );
}
