import { describe, expect, it } from 'vitest';

import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { DriverStatus } from '@/domain/driver/value-objects/driver-status';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const now = new Date('2026-08-28T00:00:00.000Z');

describe('driver domain', () => {
  it('normalizes optional contact values and defaults to active', () => {
    const driver = new Driver({
      publicId: publicId('000000000011'),
      name: DriverName.from('  Juan   Dela Cruz '),
      contactNumber: DriverContactNumber.optional(' 0917  123 4567 '),
      createdAt: now,
      updatedAt: now,
    });

    expect(driver.name.toString()).toBe('Juan Dela Cruz');
    expect(driver.contactNumber?.toString()).toBe('0917 123 4567');
    expect(driver.isOperational()).toBe(true);
    expect(DriverContactNumber.optional('   ')).toBeNull();
  });

  it('restores a deleted driver as inactive', () => {
    const driver = new Driver({
      publicId: publicId('000000000012'),
      name: DriverName.from('Maria Santos'),
      contactNumber: null,
      createdAt: now,
      updatedAt: now,
    });
    driver.softDelete({
      at: now,
      actorPublicId: publicId('000000000013'),
      reason: 'Driver record is no longer current.',
    });
    expect(() => driver.updateDetails(DriverName.from('Changed'), null, now)).toThrow();
    driver.restore(now);
    expect(driver.status.toString()).toBe('INACTIVE');
    expect(driver.isOperational()).toBe(false);
  });

  it('enforces driver field and status limits', () => {
    expect(() => DriverName.from('')).toThrow();
    expect(() => DriverContactNumber.optional('x'.repeat(51))).toThrow();
    expect(() => DriverStatus.from('SUSPENDED')).toThrow();
  });
});
