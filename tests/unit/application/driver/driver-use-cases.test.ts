import { describe, expect, it, vi } from 'vitest';

import { CreateDriver } from '@/application/driver/use-cases/create-driver';
import { GetDriver } from '@/application/driver/use-cases/get-driver';
import { ListDrivers } from '@/application/driver/use-cases/list-drivers';
import { ListOperationalDriverOptions } from '@/application/driver/use-cases/list-operational-driver-options';
import { RestoreDriver } from '@/application/driver/use-cases/restore-driver';
import { SoftDeleteDriver } from '@/application/driver/use-cases/soft-delete-driver';
import { UpdateDriver } from '@/application/driver/use-cases/update-driver';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { PublicId } from '@/domain/shared/value-objects/public-id';

import {
  createMasterDataTestDependencies,
  requestContext,
} from '../master-data/master-data-test-helpers';

const id = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const driver = (deleted = false) =>
  new Driver({
    publicId: id('000000000020'),
    name: DriverName.from('Juan Dela Cruz'),
    contactNumber: DriverContactNumber.optional('0917 123 4567'),
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
    deletedAt: deleted ? new Date('2026-08-28T01:00:00.000Z') : null,
    deletedByActorPublicId: deleted ? id('000000000001') : null,
    deleteReason: deleted ? 'Driver left provincial service.' : null,
  });

describe('driver use cases', () => {
  it('returns contact to managers but never writes it to immutable audit data', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const result = await new CreateDriver(dependencies).execute({
      context: requestContext(['driver.manage']),
      command: { name: 'Juan Dela Cruz', contactNumber: '0917 123 4567' },
    });
    expect(result.contactNumber).toBe('0917 123 4567');
    expect(JSON.stringify(vi.mocked(repositories.auditEvents.append).mock.calls)).not.toContain(
      '0917 123 4567',
    );
    expect(JSON.stringify(vi.mocked(repositories.auditEvents.append).mock.calls)).toContain(
      'hasContactNumber',
    );
  });

  it('marks contact changes without capturing either contact value', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = driver();
    vi.mocked(repositories.drivers.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    await new UpdateDriver(dependencies).execute({
      context: requestContext(['driver.manage']),
      publicId: target.publicId.toString(),
      command: { contactNumber: '0999 000 0000', status: 'INACTIVE' },
    });
    const events = JSON.stringify(vi.mocked(repositories.auditEvents.append).mock.calls);
    expect(events).toContain('contactNumberChanged');
    expect(events).not.toContain('0917 123 4567');
    expect(events).not.toContain('0999 000 0000');
  });

  it('treats an empty driver update as a no-op', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = driver();
    vi.mocked(repositories.drivers.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    const result = await new UpdateDriver(dependencies).execute({
      context: requestContext(['driver.manage']),
      publicId: target.publicId.toString(),
      command: {},
    });
    expect(result).toMatchObject({ name: 'Juan Dela Cruz', status: 'ACTIVE' });
    expect(repositories.drivers.updateDetails).not.toHaveBeenCalled();
    expect(repositories.drivers.updateStatus).not.toHaveBeenCalled();
    expect(repositories.auditEvents.append).not.toHaveBeenCalled();
  });

  it('restores drivers inactive and enforces deletion reason bounds', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    await expect(
      new SoftDeleteDriver(dependencies).execute({
        context: requestContext(['driver.manage']),
        publicId: id('000000000020').toString(),
        reason: 'short',
      }),
    ).rejects.toThrow();
    const target = driver(true);
    vi.mocked(repositories.drivers.findDeletedByPublicIdForUpdate).mockResolvedValue(target);
    await new RestoreDriver(dependencies).execute({
      context: requestContext(['driver.manage']),
      publicId: target.publicId.toString(),
    });
    expect(target.status.toString()).toBe('INACTIVE');
  });

  it('serves contact-free operational options to read-only principals', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    vi.mocked(repositories.drivers.listOperational).mockResolvedValue({
      items: [{ publicId: id('000000000020').toString(), name: 'Juan Dela Cruz' }],
      nextCursor: null,
      previousCursor: null,
    });
    const result = await new ListOperationalDriverOptions(dependencies).execute({
      context: requestContext(['driver.read']),
      query: {
        mode: 'operational',
        query: null,
        lifecycle: 'current',
        status: null,
        cursor: null,
        pageSize: 50,
      },
    });
    expect(result.items[0]).toEqual({
      publicId: id('000000000020').toString(),
      name: 'Juan Dela Cruz',
    });
    expect(result.items[0]).not.toHaveProperty('contactNumber');
  });

  it('gets, lists, and rejects missing administration records', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = driver();
    vi.mocked(repositories.drivers.findIncludingDeletedByPublicId).mockResolvedValueOnce(target);
    await expect(
      new GetDriver(dependencies).execute({
        context: requestContext(['driver.manage']),
        publicId: target.publicId.toString(),
      }),
    ).resolves.toMatchObject({ contactNumber: '0917 123 4567' });
    await expect(
      new GetDriver(dependencies).execute({
        context: requestContext(['driver.manage']),
        publicId: target.publicId.toString(),
      }),
    ).rejects.toThrow('not found');

    const query = {
      mode: 'admin',
      query: null,
      lifecycle: 'current',
      status: null,
      cursor: null,
      pageSize: 25,
    } as const;
    await new ListDrivers(dependencies).execute({
      context: requestContext(['driver.manage']),
      query,
    });
    expect(repositories.drivers.listAdmin).toHaveBeenCalledWith(query);
  });

  it('soft-deletes without contact evidence and covers missing and oversized reasons', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = driver();
    vi.mocked(repositories.drivers.findCurrentByPublicIdForUpdate).mockResolvedValueOnce(target);
    const useCase = new SoftDeleteDriver(dependencies);
    await useCase.execute({
      context: requestContext(['driver.manage']),
      publicId: target.publicId.toString(),
      reason: '  Driver   no longer assigned. ',
    });
    const events = JSON.stringify(vi.mocked(repositories.auditEvents.append).mock.calls);
    expect(events).toContain('driver.deleted');
    expect(events).not.toContain('0917 123 4567');

    await expect(
      useCase.execute({
        context: requestContext(['driver.manage']),
        publicId: target.publicId.toString(),
        reason: 'Driver record is unavailable.',
      }),
    ).rejects.toThrow('not found');
    await expect(
      useCase.execute({
        context: requestContext(['driver.manage']),
        publicId: target.publicId.toString(),
        reason: 'x'.repeat(501),
      }),
    ).rejects.toThrow('invalid data');
  });
});
