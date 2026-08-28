import { z } from 'zod';

import type {
  MasterDataListQuery,
  MasterDataResource,
} from '@/application/master-data/dto/master-data-list-dtos';
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

export const masterDataPublicIdSchema = z
  .string()
  .uuid()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const pageFields = {
  query: optionalText(150),
  cursor: optionalText(2_048),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
};

const adminListSchema = z
  .object({
    mode: z.literal('admin'),
    ...pageFields,
    lifecycle: z.enum(['current', 'deleted', 'all']).default('current'),
    status: optionalText(16),
  })
  .strict();
const operationalListSchema = z.object({ mode: z.literal('operational'), ...pageFields }).strict();

export const masterDataListQuerySchema = z.preprocess(
  (value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    const input = value as Record<string, unknown>;
    return { ...input, mode: input.mode === undefined || input.mode === '' ? 'admin' : input.mode };
  },
  z.discriminatedUnion('mode', [adminListSchema, operationalListSchema]),
);

export const createOfficeSchema = z
  .object({ name: normalizedText(1, 150), abbreviation: normalizedText(1, 30) })
  .strict();
export const updateOfficeSchema = z
  .object({
    name: normalizedText(1, 150).optional(),
    abbreviation: normalizedText(1, 30).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined));

export const createDriverSchema = z
  .object({
    name: normalizedText(1, 150),
    contactNumber: z.union([normalizedText(1, 50), z.literal(''), z.null()]).optional(),
  })
  .strict();
export const updateDriverSchema = z
  .object({
    name: normalizedText(1, 150).optional(),
    contactNumber: z.union([normalizedText(1, 50), z.literal(''), z.null()]).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined));

export const createVehicleSchema = z
  .object({
    modelBrand: normalizedText(1, 150),
    vehicleType: normalizedText(1, 100),
    plateNumber: normalizedText(1, 30),
    remarks: z.union([normalizedText(1, 2_000), z.literal(''), z.null()]).optional(),
  })
  .strict();
export const updateVehicleSchema = z
  .object({
    modelBrand: normalizedText(1, 150).optional(),
    vehicleType: normalizedText(1, 100).optional(),
    plateNumber: normalizedText(1, 30).optional(),
    status: z.enum(['SERVICEABLE', 'UNSERVICEABLE']).optional(),
    remarks: z.union([normalizedText(1, 2_000), z.literal(''), z.null()]).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined));

export const masterDataReasonSchema = z.object({ reason: normalizedText(10, 500) }).strict();
export const emptyBodySchema = z.object({}).strict();

const statuses: Readonly<Record<MasterDataResource, readonly string[]>> = {
  office: ['ACTIVE', 'INACTIVE'],
  driver: ['ACTIVE', 'INACTIVE'],
  vehicle: ['SERVICEABLE', 'UNSERVICEABLE'],
};

export function parseMasterDataListQuery(
  resource: MasterDataResource,
  input: unknown,
): MasterDataListQuery {
  const parsed = masterDataListQuerySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError();
  if (
    parsed.data.mode === 'admin' &&
    parsed.data.status !== undefined &&
    !statuses[resource].includes(parsed.data.status)
  ) {
    throw new ValidationError([{ field: 'status', reason: 'Select a valid status.' }]);
  }
  return {
    mode: parsed.data.mode,
    query: parsed.data.query ?? null,
    lifecycle: parsed.data.mode === 'admin' ? parsed.data.lifecycle : 'current',
    status: parsed.data.mode === 'admin' ? (parsed.data.status ?? null) : null,
    cursor: parsed.data.cursor ?? null,
    pageSize: parsed.data.pageSize,
  };
}
