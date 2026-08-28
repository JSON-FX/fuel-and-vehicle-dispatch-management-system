import { z } from 'zod';

import type {
  DispatchListQuery,
  DispatchScheduleCandidateDto,
  DispatchScheduleQuery,
} from '@/application/dispatch/dto/dispatch-dtos';
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
const optionalCivilDateSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  civilDateSchema.optional(),
);
const odometerSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,10})(?:\.\d)?$/,
    'Provide a nonnegative odometer reading with up to one decimal place.',
  );

const conflictOverrideSchema = z
  .object({
    acknowledged: z.literal(true),
    reason: normalizedText(10, 500),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export const dispatchPublicIdSchema = z
  .string()
  .uuid()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const dispatchFields = {
  entryDate: civilDateSchema,
  travelDate: civilDateSchema,
  driverPublicId: dispatchPublicIdSchema,
  vehiclePublicId: dispatchPublicIdSchema,
  requestingOfficePublicId: dispatchPublicIdSchema,
  destination: normalizedText(1, 255),
  purpose: normalizedText(1, 500),
  odoBefore: odometerSchema,
  passengerCount: z.number().int().min(0).max(4_294_967_295),
};

export const createDispatchSchema = z
  .object({ ...dispatchFields, conflictOverride: conflictOverrideSchema.optional() })
  .strict();
export const updateDispatchSchema = z
  .object({ ...dispatchFields, conflictOverride: conflictOverrideSchema.optional() })
  .strict();
export const emptyDispatchBodySchema = z.object({}).strict();
export const dispatchVehicleSchema = z
  .object({ conflictOverride: conflictOverrideSchema.optional() })
  .strict();
export const completeDispatchSchema = z.object({ odoAfter: odometerSchema }).strict();
export const cancelDispatchSchema = z.object({ reason: normalizedText(10, 500) }).strict();
export const updateDispatchScheduleSettingsSchema = z
  .object({ policy: z.enum(['BLOCK', 'WARN_AND_ACK']) })
  .strict();

const optionalPublicIdSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  dispatchPublicIdSchema.optional(),
);
const dispatchConflictQuerySchema = z
  .object({
    travelDate: civilDateSchema,
    driverPublicId: dispatchPublicIdSchema,
    vehiclePublicId: dispatchPublicIdSchema,
    excludedDispatchPublicId: optionalPublicIdSchema,
  })
  .strict();
const dispatchScheduleQuerySchema = z
  .object({
    from: civilDateSchema,
    to: civilDateSchema,
    requestingOfficePublicId: optionalPublicIdSchema,
    driverPublicId: optionalPublicIdSchema,
    vehiclePublicId: optionalPublicIdSchema,
    status: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED']).optional(),
    ),
    limit: z.coerce.number().int().min(1).max(200).default(200),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'End date must be on or after the start date.',
      });
      return;
    }
    if (inclusiveCivilDateCount(value.from, value.to) > 42) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Schedule ranges may include at most 42 calendar days.',
      });
    }
  });

const dispatchListSchema = z
  .object({
    query: optionalText(150),
    status: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED']).optional(),
    ),
    requestingOfficePublicId: z.preprocess(
      (value) => (value === '' ? undefined : value),
      dispatchPublicIdSchema.optional(),
    ),
    travelDateFrom: optionalCivilDateSchema,
    travelDateTo: optionalCivilDateSchema,
    cursor: optionalText(2_048),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()
  .refine(
    (value) =>
      value.travelDateFrom === undefined ||
      value.travelDateTo === undefined ||
      value.travelDateFrom <= value.travelDateTo,
    {
      path: ['travelDateTo'],
      message: 'End date must be on or after the start date.',
    },
  );

export function parseDispatchListQuery(input: unknown): DispatchListQuery {
  const parsed = dispatchListSchema.safeParse(input);
  if (!parsed.success) throwValidation(parsed.error);
  return {
    query: parsed.data.query ?? null,
    status: parsed.data.status ?? null,
    requestingOfficePublicId: parsed.data.requestingOfficePublicId ?? null,
    travelDateFrom: parsed.data.travelDateFrom ?? null,
    travelDateTo: parsed.data.travelDateTo ?? null,
    cursor: parsed.data.cursor ?? null,
    pageSize: parsed.data.pageSize,
  };
}

export function parseDispatchConflictQuery(input: unknown): DispatchScheduleCandidateDto {
  const parsed = dispatchConflictQuerySchema.safeParse(input);
  if (!parsed.success) throwValidation(parsed.error);
  return {
    travelDate: parsed.data.travelDate,
    driverPublicId: parsed.data.driverPublicId,
    vehiclePublicId: parsed.data.vehiclePublicId,
    excludedDispatchPublicId: parsed.data.excludedDispatchPublicId ?? null,
  };
}

export function parseDispatchScheduleQuery(input: unknown): DispatchScheduleQuery {
  const parsed = dispatchScheduleQuerySchema.safeParse(input);
  if (!parsed.success) throwValidation(parsed.error);
  return {
    from: parsed.data.from,
    to: parsed.data.to,
    requestingOfficePublicId: parsed.data.requestingOfficePublicId ?? null,
    driverPublicId: parsed.data.driverPublicId ?? null,
    vehiclePublicId: parsed.data.vehiclePublicId ?? null,
    status: parsed.data.status ?? null,
    limit: parsed.data.limit,
  };
}

export function dispatchSearchParams(searchParams: URLSearchParams): Record<string, unknown> {
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

function inclusiveCivilDateCount(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number) as [number, number, number];
  const [toYear, toMonth, toDay] = to.split('-').map(Number) as [number, number, number];
  return (
    Math.floor(
      (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) /
        86_400_000,
    ) + 1
  );
}
