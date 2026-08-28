import { describe, expect, it, vi } from 'vitest';

import { CreateOffice } from '@/application/office/use-cases/create-office';
import { GetOffice } from '@/application/office/use-cases/get-office';
import { ListOffices } from '@/application/office/use-cases/list-offices';
import { ListOperationalOfficeOptions } from '@/application/office/use-cases/list-operational-office-options';
import { RestoreOffice } from '@/application/office/use-cases/restore-office';
import { SoftDeleteOffice } from '@/application/office/use-cases/soft-delete-office';
import { UpdateOffice } from '@/application/office/use-cases/update-office';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { PublicId } from '@/domain/shared/value-objects/public-id';

import {
  createMasterDataTestDependencies,
  requestContext,
} from '../master-data/master-data-test-helpers';

const id = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const office = (deleted = false) =>
  new Office({
    publicId: id('000000000010'),
    name: OfficeName.from('Budget Office'),
    abbreviation: OfficeAbbreviation.from('BO'),
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
    deletedAt: deleted ? new Date('2026-08-28T01:00:00.000Z') : null,
    deletedByActorPublicId: deleted ? id('000000000001') : null,
    deleteReason: deleted ? 'Duplicate office reference.' : null,
  });

describe('office use cases', () => {
  it('creates an active office and appends an audit event atomically', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const result = await new CreateOffice(dependencies).execute({
      context: requestContext(['office.manage']),
      command: { name: ' Provincial   Engineering ', abbreviation: ' peo ' },
    });

    expect(result).toMatchObject({
      name: 'Provincial Engineering',
      abbreviation: 'PEO',
      status: 'ACTIVE',
    });
    expect(repositories.offices.insert).toHaveBeenCalledOnce();
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'office.created' }),
    );
  });

  it('emits separate detail and status events and suppresses no-op noise', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = office();
    vi.mocked(repositories.offices.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    const useCase = new UpdateOffice(dependencies);

    const result = await useCase.execute({
      context: requestContext(['office.manage']),
      publicId: target.publicId.toString(),
      command: { name: 'Provincial Budget Office', status: 'INACTIVE' },
    });
    expect(result.status).toBe('INACTIVE');
    expect(repositories.auditEvents.append).toHaveBeenCalledTimes(2);

    vi.mocked(repositories.auditEvents.append).mockClear();
    await useCase.execute({
      context: requestContext(['office.manage']),
      publicId: target.publicId.toString(),
      command: { name: 'Provincial Budget Office', status: 'INACTIVE' },
    });
    expect(repositories.auditEvents.append).not.toHaveBeenCalled();
  });

  it('treats an empty office update as a no-op', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = office();
    vi.mocked(repositories.offices.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    const result = await new UpdateOffice(dependencies).execute({
      context: requestContext(['office.manage']),
      publicId: target.publicId.toString(),
      command: {},
    });
    expect(result).toMatchObject({ name: 'Budget Office', status: 'ACTIVE' });
    expect(repositories.offices.updateDetails).not.toHaveBeenCalled();
    expect(repositories.offices.updateStatus).not.toHaveBeenCalled();
    expect(repositories.auditEvents.append).not.toHaveBeenCalled();
  });

  it('validates deletion reasons and restores offices as inactive', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    await expect(
      new SoftDeleteOffice(dependencies).execute({
        context: requestContext(['office.manage']),
        publicId: id('000000000010').toString(),
        reason: 'short',
      }),
    ).rejects.toThrow();

    const deleted = office(true);
    vi.mocked(repositories.offices.findDeletedByPublicIdForUpdate).mockResolvedValue(deleted);
    await new RestoreOffice(dependencies).execute({
      context: requestContext(['office.manage']),
      publicId: deleted.publicId.toString(),
    });
    expect(deleted.status.toString()).toBe('INACTIVE');
    expect(repositories.offices.restore).toHaveBeenCalledOnce();
  });

  it('allows read-only operational access but not unrelated permissions', async () => {
    const { dependencies } = createMasterDataTestDependencies();
    const useCase = new ListOperationalOfficeOptions(dependencies);
    const query = {
      mode: 'operational',
      query: null,
      lifecycle: 'current',
      status: null,
      cursor: null,
      pageSize: 50,
    } as const;
    await expect(
      useCase.execute({ context: requestContext(['office.read']), query }),
    ).resolves.toMatchObject({ items: [] });
    await expect(
      useCase.execute({ context: requestContext(['vehicle.read']), query }),
    ).rejects.toThrow();
  });

  it('gets and lists administration records while preserving not-found behavior', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = office(true);
    vi.mocked(repositories.offices.findIncludingDeletedByPublicId).mockResolvedValueOnce(target);

    await expect(
      new GetOffice(dependencies).execute({
        context: requestContext(['office.manage']),
        publicId: target.publicId.toString(),
      }),
    ).resolves.toMatchObject({ deletedAt: '2026-08-28T01:00:00.000Z' });
    await expect(
      new GetOffice(dependencies).execute({
        context: requestContext(['office.manage']),
        publicId: target.publicId.toString(),
      }),
    ).rejects.toThrow('not found');

    const query = {
      mode: 'admin',
      query: null,
      lifecycle: 'all',
      status: null,
      cursor: null,
      pageSize: 25,
    } as const;
    await new ListOffices(dependencies).execute({
      context: requestContext(['office.manage']),
      query,
    });
    expect(repositories.offices.listAdmin).toHaveBeenCalledWith(query);
  });

  it('soft-deletes with a normalized reason and handles missing and oversized input', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = office();
    vi.mocked(repositories.offices.findCurrentByPublicIdForUpdate).mockResolvedValueOnce(target);
    const useCase = new SoftDeleteOffice(dependencies);

    await useCase.execute({
      context: requestContext(['office.manage']),
      publicId: target.publicId.toString(),
      reason: '  Duplicate   office record.  ',
    });
    expect(target.deleteReason).toBe('Duplicate office record.');
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'office.deleted' }),
    );

    await expect(
      useCase.execute({
        context: requestContext(['office.manage']),
        publicId: target.publicId.toString(),
        reason: 'A valid deletion reason.',
      }),
    ).rejects.toThrow('not found');
    await expect(
      useCase.execute({
        context: requestContext(['office.manage']),
        publicId: target.publicId.toString(),
        reason: 'x'.repeat(501),
      }),
    ).rejects.toThrow('invalid data');
  });
});
