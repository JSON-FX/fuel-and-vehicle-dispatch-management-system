import { describe, expect, it } from 'vitest';

import {
  cancelDispatchSchema,
  completeDispatchSchema,
  createDispatchSchema,
  dispatchPublicIdSchema,
  dispatchVehicleSchema,
  emptyDispatchBodySchema,
  parseDispatchConflictQuery,
  parseDispatchListQuery,
  parseDispatchScheduleQuery,
  updateDispatchScheduleSettingsSchema,
  updateDispatchSchema,
} from '@/lib/dispatch/route-schemas';

const draft = {
  entryDate: '2026-08-28',
  travelDate: '2026-08-29',
  driverPublicId: '01900000-0000-7000-8000-000000000001',
  vehiclePublicId: '01900000-0000-7000-8000-000000000002',
  requestingOfficePublicId: '01900000-0000-7000-8000-000000000003',
  destination: ' District   Hospital ',
  purpose: ' Transfer   medical supplies ',
  odoBefore: '1250.4',
  passengerCount: 2,
};

describe('dispatch route schemas', () => {
  it('normalizes draft text and rejects client-controlled lifecycle fields', () => {
    expect(createDispatchSchema.parse(draft)).toMatchObject({
      destination: 'District Hospital',
      purpose: 'Transfer medical supplies',
    });
    expect(() => createDispatchSchema.parse({ ...draft, status: 'DISPATCHED' })).toThrow();
    expect(() => updateDispatchSchema.parse({ ...draft, odoAfter: '1260.4' })).toThrow();
  });

  it('accepts only reviewed reason and fingerprint as conflict evidence', () => {
    const conflictOverride = {
      acknowledged: true,
      reason: ' Reviewed   both schedules and approved the trip. ',
      fingerprint: 'a'.repeat(64),
    };
    expect(createDispatchSchema.parse({ ...draft, conflictOverride })).toMatchObject({
      conflictOverride: {
        acknowledged: true,
        reason: 'Reviewed both schedules and approved the trip.',
        fingerprint: 'a'.repeat(64),
      },
    });
    expect(dispatchVehicleSchema.parse({ conflictOverride })).toMatchObject({
      conflictOverride: {
        ...conflictOverride,
        reason: 'Reviewed both schedules and approved the trip.',
      },
    });
    expect(() =>
      createDispatchSchema.parse({
        ...draft,
        conflictOverride: { ...conflictOverride, policy: 'WARN_AND_ACK' },
      }),
    ).toThrow();
    expect(() =>
      dispatchVehicleSchema.parse({
        conflictOverride: { ...conflictOverride, conflictingDispatchIds: [draft.driverPublicId] },
      }),
    ).toThrow();
  });

  it('validates civil dates, exact odometers, and passenger counts', () => {
    expect(() => createDispatchSchema.parse({ ...draft, entryDate: '2026-02-29' })).toThrow();
    expect(() => createDispatchSchema.parse({ ...draft, odoBefore: 1250.4 })).toThrow();
    expect(() => createDispatchSchema.parse({ ...draft, odoBefore: '1e3' })).toThrow();
    expect(() => createDispatchSchema.parse({ ...draft, odoBefore: '1.25' })).toThrow();
    expect(() => createDispatchSchema.parse({ ...draft, passengerCount: -1 })).toThrow();
    expect(() => createDispatchSchema.parse({ ...draft, passengerCount: 1.5 })).toThrow();
  });

  it('parses strict lifecycle command bodies', () => {
    expect(emptyDispatchBodySchema.parse({})).toEqual({});
    expect(() => emptyDispatchBodySchema.parse({ status: 'DISPATCHED' })).toThrow();
    expect(completeDispatchSchema.parse({ odoAfter: '1260' })).toEqual({ odoAfter: '1260' });
    expect(() => completeDispatchSchema.parse({ odoAfter: 1260 })).toThrow();
    expect(cancelDispatchSchema.parse({ reason: ' Vehicle   unavailable today. ' })).toEqual({
      reason: 'Vehicle unavailable today.',
    });
    expect(() => cancelDispatchSchema.parse({ reason: 'too short' })).toThrow();
  });

  it('accepts only UUIDv7 public identifiers', () => {
    expect(dispatchPublicIdSchema.parse(draft.driverPublicId)).toBe(draft.driverPublicId);
    expect(() => dispatchPublicIdSchema.parse('550e8400-e29b-41d4-a716-446655440000')).toThrow();
  });

  it('parses bounded filters and normalizes empty GET values', () => {
    expect(
      parseDispatchListQuery({
        query: '',
        status: 'DISPATCHED',
        requestingOfficePublicId: '',
        travelDateFrom: '2026-08-01',
        travelDateTo: '2026-08-31',
        pageSize: '25',
      }),
    ).toEqual({
      query: null,
      status: 'DISPATCHED',
      requestingOfficePublicId: null,
      travelDateFrom: '2026-08-01',
      travelDateTo: '2026-08-31',
      cursor: null,
      pageSize: 25,
    });
    expect(() => parseDispatchListQuery({ pageSize: '201' })).toThrow();
    expect(() =>
      parseDispatchListQuery({ travelDateFrom: '2026-09-01', travelDateTo: '2026-08-31' }),
    ).toThrow();
  });

  it('parses strict advisory and bounded schedule queries', () => {
    expect(
      parseDispatchConflictQuery({
        travelDate: '2026-08-29',
        driverPublicId: draft.driverPublicId,
        vehiclePublicId: draft.vehiclePublicId,
      }),
    ).toEqual({
      travelDate: '2026-08-29',
      driverPublicId: draft.driverPublicId,
      vehiclePublicId: draft.vehiclePublicId,
      excludedDispatchPublicId: null,
    });
    expect(
      parseDispatchScheduleQuery({ from: '2026-08-01', to: '2026-09-11', limit: '200' }),
    ).toMatchObject({ from: '2026-08-01', to: '2026-09-11', limit: 200 });
    expect(() => parseDispatchScheduleQuery({ from: '2026-08-01', to: '2026-09-12' })).toThrow();
    expect(() =>
      parseDispatchConflictQuery({
        travelDate: ['2026-08-29', '2026-08-30'],
        driverPublicId: draft.driverPublicId,
        vehiclePublicId: draft.vehiclePublicId,
      }),
    ).toThrow();
    expect(updateDispatchScheduleSettingsSchema.parse({ policy: 'BLOCK' })).toEqual({
      policy: 'BLOCK',
    });
    expect(() =>
      updateDispatchScheduleSettingsSchema.parse({
        policy: 'BLOCK',
        officePublicId: draft.driverPublicId,
      }),
    ).toThrow();
  });
});
