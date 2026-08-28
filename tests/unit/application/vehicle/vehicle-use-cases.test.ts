import { describe, expect, it, vi } from 'vitest';

import { CreateVehicle } from '@/application/vehicle/use-cases/create-vehicle';
import { GetVehicle } from '@/application/vehicle/use-cases/get-vehicle';
import { ListVehicles } from '@/application/vehicle/use-cases/list-vehicles';
import { ListOperationalVehicleOptions } from '@/application/vehicle/use-cases/list-operational-vehicle-options';
import { RestoreVehicle } from '@/application/vehicle/use-cases/restore-vehicle';
import { SoftDeleteVehicle } from '@/application/vehicle/use-cases/soft-delete-vehicle';
import { UpdateVehicle } from '@/application/vehicle/use-cases/update-vehicle';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';

import {
  createMasterDataTestDependencies,
  requestContext,
} from '../master-data/master-data-test-helpers';

const id = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const vehicle = (deleted = false) =>
  new Vehicle({
    publicId: id('000000000030'),
    modelBrand: ModelBrand.from('Toyota Hiace'),
    vehicleType: VehicleType.from('Passenger Van'),
    plateNumber: PlateNumber.from('ABC-123'),
    remarks: VehicleRemarks.optional('Pool vehicle'),
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
    deletedAt: deleted ? new Date('2026-08-28T01:00:00.000Z') : null,
    deletedByActorPublicId: deleted ? id('000000000001') : null,
    deleteReason: deleted ? 'Vehicle reference is obsolete.' : null,
  });

describe('vehicle use cases', () => {
  it('creates serviceable vehicles with normalized plates', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const result = await new CreateVehicle(dependencies).execute({
      context: requestContext(['vehicle.manage']),
      command: {
        modelBrand: 'Toyota Hiace',
        vehicleType: 'Passenger Van',
        plateNumber: ' abc-123 ',
        remarks: '',
      },
    });
    expect(result).toMatchObject({ plateNumber: 'ABC-123', status: 'SERVICEABLE', remarks: null });
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'vehicle.created' }),
    );
  });

  it('updates details and serviceability in separate audit events', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = vehicle();
    vi.mocked(repositories.vehicles.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    const result = await new UpdateVehicle(dependencies).execute({
      context: requestContext(['vehicle.manage']),
      publicId: target.publicId.toString(),
      command: { plateNumber: 'xyz/999', status: 'UNSERVICEABLE' },
    });
    expect(result.plateNumber).toBe('XYZ/999');
    expect(result.status).toBe('UNSERVICEABLE');
    expect(repositories.auditEvents.append).toHaveBeenCalledTimes(2);
  });

  it('treats an empty vehicle update as a no-op', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = vehicle();
    vi.mocked(repositories.vehicles.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    const result = await new UpdateVehicle(dependencies).execute({
      context: requestContext(['vehicle.manage']),
      publicId: target.publicId.toString(),
      command: {},
    });
    expect(result).toMatchObject({ plateNumber: 'ABC-123', status: 'SERVICEABLE' });
    expect(repositories.vehicles.updateDetails).not.toHaveBeenCalled();
    expect(repositories.vehicles.updateStatus).not.toHaveBeenCalled();
    expect(repositories.auditEvents.append).not.toHaveBeenCalled();
  });

  it('restores vehicles unserviceable and validates deletion reasons', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    await expect(
      new SoftDeleteVehicle(dependencies).execute({
        context: requestContext(['vehicle.manage']),
        publicId: id('000000000030').toString(),
        reason: 'short',
      }),
    ).rejects.toThrow();
    const target = vehicle(true);
    vi.mocked(repositories.vehicles.findDeletedByPublicIdForUpdate).mockResolvedValue(target);
    await new RestoreVehicle(dependencies).execute({
      context: requestContext(['vehicle.manage']),
      publicId: target.publicId.toString(),
    });
    expect(target.status.toString()).toBe('UNSERVICEABLE');
  });

  it('uses read-or-manage authorization for operational vehicle options', async () => {
    const { dependencies } = createMasterDataTestDependencies();
    const query = {
      mode: 'operational',
      query: null,
      lifecycle: 'current',
      status: null,
      cursor: null,
      pageSize: 50,
    } as const;
    await expect(
      new ListOperationalVehicleOptions(dependencies).execute({
        context: requestContext(['vehicle.manage']),
        query,
      }),
    ).resolves.toMatchObject({ items: [] });
  });

  it('gets and lists administration records while rejecting missing vehicles', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = vehicle(true);
    vi.mocked(repositories.vehicles.findIncludingDeletedByPublicId).mockResolvedValueOnce(target);
    await expect(
      new GetVehicle(dependencies).execute({
        context: requestContext(['vehicle.manage']),
        publicId: target.publicId.toString(),
      }),
    ).resolves.toMatchObject({ remarks: 'Pool vehicle', deletedAt: expect.any(String) });
    await expect(
      new GetVehicle(dependencies).execute({
        context: requestContext(['vehicle.manage']),
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
    await new ListVehicles(dependencies).execute({
      context: requestContext(['vehicle.manage']),
      query,
    });
    expect(repositories.vehicles.listAdmin).toHaveBeenCalledWith(query);
  });

  it('soft-deletes with normalized evidence and covers missing and oversized reasons', async () => {
    const { dependencies, repositories } = createMasterDataTestDependencies();
    const target = vehicle();
    vi.mocked(repositories.vehicles.findCurrentByPublicIdForUpdate).mockResolvedValueOnce(target);
    const useCase = new SoftDeleteVehicle(dependencies);
    await useCase.execute({
      context: requestContext(['vehicle.manage']),
      publicId: target.publicId.toString(),
      reason: '  Vehicle   reference retired. ',
    });
    expect(target.deleteReason).toBe('Vehicle reference retired.');
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'vehicle.deleted' }),
    );

    await expect(
      useCase.execute({
        context: requestContext(['vehicle.manage']),
        publicId: target.publicId.toString(),
        reason: 'Vehicle record is unavailable.',
      }),
    ).rejects.toThrow('not found');
    await expect(
      useCase.execute({
        context: requestContext(['vehicle.manage']),
        publicId: target.publicId.toString(),
        reason: 'x'.repeat(501),
      }),
    ).rejects.toThrow('invalid data');
  });
});
