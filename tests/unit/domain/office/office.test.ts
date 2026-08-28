import { describe, expect, it } from 'vitest';

import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { OfficeStatus } from '@/domain/office/value-objects/office-status';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const now = new Date('2026-08-28T00:00:00.000Z');

describe('office domain', () => {
  it('normalizes office values and defaults new offices to active', () => {
    const office = new Office({
      publicId: publicId('000000000001'),
      name: OfficeName.from('  Provincial   Engineering  Office '),
      abbreviation: OfficeAbbreviation.from(' peo '),
      createdAt: now,
      updatedAt: now,
    });

    expect(office.name.toString()).toBe('Provincial Engineering Office');
    expect(office.abbreviation.toString()).toBe('PEO');
    expect(office.status.toString()).toBe('ACTIVE');
    expect(office.isOperational()).toBe(true);
  });

  it('restores a deleted office as inactive and blocks deleted edits', () => {
    const office = new Office({
      publicId: publicId('000000000002'),
      name: OfficeName.from('Budget Office'),
      abbreviation: OfficeAbbreviation.from('BO'),
      createdAt: now,
      updatedAt: now,
    });

    office.softDelete({
      at: new Date('2026-08-28T01:00:00.000Z'),
      actorPublicId: publicId('000000000003'),
      reason: 'Duplicate reference record.',
    });
    expect(() => office.changeStatus(OfficeStatus.active(), now)).toThrow(
      'Deleted offices cannot be changed.',
    );

    office.restore(new Date('2026-08-28T02:00:00.000Z'));
    expect(office.status.toString()).toBe('INACTIVE');
    expect(office.isOperational()).toBe(false);
    expect(office.deleteReason).toBeNull();
  });

  it('rejects blank or oversized values and invalid statuses', () => {
    expect(() => OfficeName.from(' ')).toThrow();
    expect(() => OfficeName.from('x'.repeat(151))).toThrow();
    expect(() => OfficeAbbreviation.from('x'.repeat(31))).toThrow();
    expect(() => OfficeStatus.from('ARCHIVED')).toThrow();
  });
});
