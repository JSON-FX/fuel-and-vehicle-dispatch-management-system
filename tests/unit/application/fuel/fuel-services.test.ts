import { describe, expect, it } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { toFuelIssuanceDetailDto } from '@/application/fuel/dto/fuel-dtos';
import {
  buildFuelIssuanceAuditEvent,
  fuelIssuanceAuditSnapshot,
} from '@/application/fuel/services/fuel-audit-events';
import { FuelPermissionPolicy } from '@/application/fuel/services/fuel-permission-policy';
import { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { PurchaseRequestNumber } from '@/domain/fuel/value-objects/purchase-request-number';
import { UnitPrice } from '@/domain/fuel/value-objects/unit-price';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);

function principal(permissions: readonly string[]): CurrentPrincipal {
  return {
    userPublicId: publicId('000000000401').toString(),
    username: 'psmd.staff',
    fullName: 'PSMD Staff',
    roles: ['PSMD_STAFF'],
    permissions,
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  };
}

function issuance(): FuelIssuance {
  return new FuelIssuance({
    publicId: publicId('000000000402'),
    purchaseRequestNumber: PurchaseRequestNumber.from('PR-2026-001'),
    entryDate: EntryDate.from('2026-08-28'),
    driverPublicId: publicId('000000000403'),
    destination: 'AOR',
    purpose: 'Provincial operations',
    vehiclePublicId: publicId('000000000404'),
    requestedLiters: FuelQuantity.from('30'),
    isFullTank: false,
    issuedLiters: null,
    unitPrice: UnitPrice.from('61.25'),
    budgetAllocationPublicId: publicId('000000000405'),
    fuelType: FuelType.diesel(),
    createdByActorPublicId: publicId('000000000401'),
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
  });
}

describe('fuel application services', () => {
  it('enforces create, read, post, and void permissions independently', () => {
    const policy = new FuelPermissionPolicy();

    expect(policy.canCreate(principal(['fuel.create']))).toBe(true);
    expect(policy.canRead(principal(['fuel.read']))).toBe(true);
    expect(policy.canPost(principal(['fuel.post']))).toBe(true);
    expect(policy.canVoid(principal(['fuel.void']))).toBe(true);
    expect(policy.canRead(principal(['fuel.create']))).toBe(false);
    expect(policy.canVoid(principal(['fuel.post']))).toBe(false);
    expect(() => policy.assertCanCreate(principal([]))).toThrow('not allowed');
    expect(() => policy.assertCanRead(principal([]))).toThrow('not allowed');
    expect(() => policy.assertCanPost(principal([]))).toThrow('not allowed');
    expect(() => policy.assertCanVoid(principal([]))).toThrow('not allowed');
  });

  it('creates an allowlisted audit snapshot with decimal strings and no contact data', () => {
    const snapshot = fuelIssuanceAuditSnapshot(issuance());

    expect(snapshot).toEqual({
      risNumber: null,
      purchaseRequestNumber: 'PR-2026-001',
      entryDate: '2026-08-28',
      driverPublicId: '01900000-0000-7000-8000-000000000403',
      destination: 'AOR',
      purpose: 'Provincial operations',
      vehiclePublicId: '01900000-0000-7000-8000-000000000404',
      requestedLiters: '30',
      isFullTank: false,
      issuedLiters: null,
      unitPrice: '61.25',
      totalAmount: null,
      budgetAllocationPublicId: '01900000-0000-7000-8000-000000000405',
      fuelType: 'DIESEL',
      status: 'DRAFT',
    });
    expect(snapshot).not.toHaveProperty('contactNumber');
    expect(snapshot).not.toHaveProperty('createdByActorPublicId');
  });

  it.each(['created', 'updated', 'posted', 'voided'] as const)(
    'builds a valid fuel_issuance.%s audit event',
    (action) => {
      const target = issuance();
      const event = buildFuelIssuanceAuditEvent({
        publicId: publicId('000000000406').toString(),
        action,
        entityPublicId: target.publicId.toString(),
        actorPublicId: principal([]).userPublicId,
        requestId: 'request-fvd-006',
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest',
        occurredAt: new Date('2026-08-28T01:00:00.000Z'),
        after: fuelIssuanceAuditSnapshot(target),
      });

      expect(event.action).toBe(`fuel_issuance.${action}`);
      expect(event.entity).toEqual({
        type: 'fuel_issuance',
        publicId: target.publicId.toString(),
      });
    },
  );

  it('maps a historical issuance record to a serializable detail DTO', () => {
    const target = issuance();
    const result = toFuelIssuanceDetailDto({
      issuance: target,
      driver: { publicId: target.driverPublicId.toString(), name: 'Juan Dela Cruz' },
      vehicle: {
        publicId: target.vehiclePublicId.toString(),
        plateNumber: 'ABC-123',
        modelBrand: 'Toyota Hiace',
        vehicleType: 'Passenger Van',
      },
      allocation: {
        publicId: target.budgetAllocationPublicId.toString(),
        ppmpNumber: 'PPMP-2026-01',
        office: {
          publicId: publicId('000000000407').toString(),
          name: 'Provincial Services Office',
          abbreviation: 'PSO',
        },
        quarter: 3,
        fiscalYear: 2026,
      },
      ledgerEntries: [],
    });

    expect(result).toMatchObject({
      publicId: target.publicId.toString(),
      requestedLiters: '30',
      issuedLiters: null,
      unitPrice: '61.25',
      totalAmount: null,
      driver: { name: 'Juan Dela Cruz' },
      vehicle: { vehicleType: 'Passenger Van' },
      ledgerEntries: [],
    });
    expect(result.createdAt).toBe('2026-08-28T00:00:00.000Z');
  });
});
