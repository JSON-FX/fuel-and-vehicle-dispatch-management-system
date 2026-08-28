import { describe, expect, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleStatus } from '@/domain/vehicle/value-objects/vehicle-status';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const now = new Date('2026-08-28T00:00:00.000Z');

describe('vehicle domain', () => {
  it('normalizes vehicle fields while preserving plate punctuation', () => {
    const vehicle = new Vehicle({
      publicId: publicId('000000000021'),
      modelBrand: ModelBrand.from(' Toyota   Hiace '),
      vehicleType: VehicleType.from(' Passenger   Van '),
      plateNumber: PlateNumber.from(' abc-123 / 4 '),
      remarks: VehicleRemarks.optional(' Pool   vehicle '),
      createdAt: now,
      updatedAt: now,
    });

    expect(vehicle.modelBrand.toString()).toBe('Toyota Hiace');
    expect(vehicle.plateNumber.toString()).toBe('ABC-123 / 4');
    expect(vehicle.remarks?.toString()).toBe('Pool vehicle');
    expect(vehicle.status.toString()).toBe('SERVICEABLE');
    expect(vehicle.isOperational()).toBe(true);
  });

  it('restores a deleted vehicle as unserviceable', () => {
    const vehicle = new Vehicle({
      publicId: publicId('000000000022'),
      modelBrand: ModelBrand.from('Isuzu'),
      vehicleType: VehicleType.from('Truck'),
      plateNumber: PlateNumber.from('TRK-100'),
      remarks: null,
      createdAt: now,
      updatedAt: now,
    });
    vehicle.softDelete({
      at: now,
      actorPublicId: publicId('000000000023'),
      reason: 'Vehicle record was entered in error.',
    });
    expect(() => vehicle.changeStatus(VehicleStatus.serviceable(), now)).toThrow();
    vehicle.restore(now);
    expect(vehicle.status.toString()).toBe('UNSERVICEABLE');
    expect(vehicle.isOperational()).toBe(false);
  });

  it('enforces field limits and optional remarks', () => {
    expect(VehicleRemarks.optional(' ')).toBeNull();
    expect(() => ModelBrand.from('')).toThrow();
    expect(() => VehicleType.from('x'.repeat(101))).toThrow();
    expect(() => PlateNumber.from('x'.repeat(31))).toThrow();
    expect(() => VehicleRemarks.optional('x'.repeat(2_001))).toThrow();
    expect(() => VehicleStatus.from('ACTIVE')).toThrow();
  });
});
