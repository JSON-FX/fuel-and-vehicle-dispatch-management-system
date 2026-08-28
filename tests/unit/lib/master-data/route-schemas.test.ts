import { describe, expect, it } from 'vitest';

import {
  createDriverSchema,
  createOfficeSchema,
  createVehicleSchema,
  masterDataPublicIdSchema,
  masterDataReasonSchema,
  parseMasterDataListQuery,
  updateVehicleSchema,
} from '@/lib/master-data/route-schemas';

describe('master-data route schemas', () => {
  it('normalizes resource fields and preserves plate punctuation', () => {
    expect(createOfficeSchema.parse({ name: ' Budget   Office ', abbreviation: ' bo ' })).toEqual({
      name: 'Budget Office',
      abbreviation: 'bo',
    });
    expect(createDriverSchema.parse({ name: ' Juan  Dela Cruz ', contactNumber: '' })).toEqual({
      name: 'Juan Dela Cruz',
      contactNumber: '',
    });
    expect(
      createVehicleSchema.parse({
        modelBrand: ' Toyota ',
        vehicleType: ' Passenger Van ',
        plateNumber: ' abc-123 / 4 ',
      }),
    ).toMatchObject({ plateNumber: 'abc-123 / 4' });
  });

  it('rejects unknown body fields, empty patches, and invalid reasons', () => {
    expect(
      createOfficeSchema.safeParse({ name: 'Budget', abbreviation: 'BO', internalId: 1 }).success,
    ).toBe(false);
    expect(updateVehicleSchema.safeParse({}).success).toBe(false);
    expect(masterDataReasonSchema.safeParse({ reason: 'short' }).success).toBe(false);
    expect(
      masterDataReasonSchema.safeParse({ reason: 'A specific deletion reason.' }).success,
    ).toBe(true);
  });

  it('requires UUID version 7 public IDs', () => {
    expect(masterDataPublicIdSchema.safeParse('01900000-0000-7000-8000-000000000001').success).toBe(
      true,
    );
    expect(masterDataPublicIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(
      false,
    );
  });

  it('parses bounded admin queries and normalizes empty native values', () => {
    expect(
      parseMasterDataListQuery('office', {
        mode: 'admin',
        query: '',
        status: '',
        lifecycle: 'current',
        pageSize: '200',
      }),
    ).toEqual({
      mode: 'admin',
      query: null,
      lifecycle: 'current',
      status: null,
      cursor: null,
      pageSize: 200,
    });
    expect(() => parseMasterDataListQuery('office', { mode: 'admin', pageSize: '201' })).toThrow();
  });

  it('keeps operational eligibility server-defined', () => {
    expect(
      parseMasterDataListQuery('vehicle', { mode: 'operational', query: '', pageSize: '50' }),
    ).toMatchObject({ mode: 'operational', lifecycle: 'current', status: null });
    expect(() =>
      parseMasterDataListQuery('vehicle', {
        mode: 'operational',
        lifecycle: 'all',
      }),
    ).toThrow();
    expect(() =>
      parseMasterDataListQuery('driver', { mode: 'operational', status: 'INACTIVE' }),
    ).toThrow();
  });
});
