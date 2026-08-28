import { describe, expect, it, vi } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { FuelRepositories } from '@/application/fuel/ports/fuel-transaction';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import { FuelPermissionPolicy } from '@/application/fuel/services/fuel-permission-policy';
import { CreateFuelIssuance } from '@/application/fuel/use-cases/create-fuel-issuance';
import { GetFuelBalances } from '@/application/fuel/use-cases/get-fuel-balances';
import { GetFuelIssuance } from '@/application/fuel/use-cases/get-fuel-issuance';
import { GetFuelPreparationOptions } from '@/application/fuel/use-cases/get-fuel-preparation-options';
import { ListFuelIssuances } from '@/application/fuel/use-cases/list-fuel-issuances';
import { PostFuelIssuance } from '@/application/fuel/use-cases/post-fuel-issuance';
import { UpdateDraftFuelIssuance } from '@/application/fuel/use-cases/update-draft-fuel-issuance';
import { VoidFuelIssuance } from '@/application/fuel/use-cases/void-fuel-issuance';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import type { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';

const at = new Date('2026-08-28T04:00:00.000Z');
const id = (suffix: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(suffix).padStart(12, '0')}`);

const principal: CurrentPrincipal = {
  userPublicId: id(1).toString(),
  username: 'psmd.staff',
  fullName: 'PSMD Staff',
  roles: ['PSMD_STAFF'],
  permissions: ['fuel.create', 'fuel.read', 'fuel.post', 'fuel.void'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};

const context = { principal, requestId: 'request-fvd-006', ipAddress: null, userAgent: 'Vitest' };
const command = {
  purchaseRequestNumber: 'PR-2026-001',
  entryDate: '2026-08-28',
  driverPublicId: id(2).toString(),
  purpose: 'Provincial operations',
  vehiclePublicId: id(3).toString(),
  requestedLiters: '30',
  isFullTank: false,
  unitPrice: '61.25',
  budgetAllocationPublicId: id(4).toString(),
  fuelType: 'DIESEL' as const,
};

function references() {
  const driver = new Driver({
    publicId: id(2),
    name: DriverName.from('Juan Dela Cruz'),
    contactNumber: DriverContactNumber.optional(null),
    createdAt: at,
    updatedAt: at,
  });
  const vehicle = new Vehicle({
    publicId: id(3),
    modelBrand: ModelBrand.from('Toyota Hiace'),
    vehicleType: VehicleType.from('Passenger Van'),
    plateNumber: PlateNumber.from('ABC-123'),
    remarks: VehicleRemarks.optional(null),
    createdAt: at,
    updatedAt: at,
  });
  const office = new Office({
    publicId: id(5),
    name: OfficeName.from('Provincial Services Office'),
    abbreviation: OfficeAbbreviation.from('PSO'),
    createdAt: at,
    updatedAt: at,
  });
  const allocation = new BudgetAllocation({
    publicId: id(4),
    ppmpNumber: PpmpNumber.from('PPMP-2026-01'),
    officePublicId: office.publicId,
    quarter: Quarter.from(3),
    fiscalYear: FiscalYear.from(2026),
    status: BudgetAllocationStatus.from('ACTIVE'),
    createdAt: at,
    updatedAt: at,
  });
  return { driver, vehicle, office, allocation };
}

function harness() {
  const refs = references();
  let issuance: FuelIssuance | null = null;
  const ledger: unknown[] = [];
  const audits: unknown[] = [];
  const lockOrder: string[] = [];
  let generated = 10;
  const referenceRecord = () => {
    if (issuance === null) return null;
    return {
      issuance,
      driver: { publicId: refs.driver.publicId.toString(), name: refs.driver.name.toString() },
      vehicle: {
        publicId: refs.vehicle.publicId.toString(),
        plateNumber: refs.vehicle.plateNumber.toString(),
        modelBrand: refs.vehicle.modelBrand.toString(),
        vehicleType: refs.vehicle.vehicleType.toString(),
      },
      allocation: {
        publicId: refs.allocation.publicId.toString(),
        ppmpNumber: refs.allocation.ppmpNumber.toString(),
        office: {
          publicId: refs.office.publicId.toString(),
          name: refs.office.name.toString(),
          abbreviation: refs.office.abbreviation.toString(),
        },
        quarter: refs.allocation.quarter.toNumber(),
        fiscalYear: refs.allocation.fiscalYear.toNumber(),
      },
    };
  };
  const repositories = {
    issuances: {
      insert: vi.fn((value: FuelIssuance) => {
        issuance = value;
        return Promise.resolve();
      }),
      updateDraft: vi.fn((value: FuelIssuance) => {
        issuance = value;
        return Promise.resolve();
      }),
      markPosted: vi.fn((value: FuelIssuance) => {
        issuance = value;
        return Promise.resolve();
      }),
      markVoided: vi.fn((value: FuelIssuance) => {
        issuance = value;
        return Promise.resolve();
      }),
      findByPublicIdForUpdate: vi.fn(() => {
        lockOrder.push('issuance');
        return Promise.resolve(issuance);
      }),
      findByPublicId: vi.fn(() => Promise.resolve(referenceRecord())),
      findDetailByPublicId: vi.fn(() => {
        const record = referenceRecord();
        return Promise.resolve(record === null ? null : { ...record, ledgerEntries: [] });
      }),
      list: vi.fn(() => {
        const record = referenceRecord();
        return Promise.resolve({
          items: record === null ? [] : [record],
          nextCursor: null,
          previousCursor: null,
        });
      }),
    },
    sequences: {
      next: vi.fn(() => {
        lockOrder.push('sequence');
        return Promise.resolve(7);
      }),
    },
    ledger: {
      append: vi.fn((entry: unknown) => {
        ledger.push(entry);
        return Promise.resolve();
      }),
      listForIssuance: vi.fn(),
      summarize: vi.fn(() =>
        Promise.resolve([
          {
            fuelType: 'DIESEL',
            startDate: '2026-08-01',
            endDate: '2026-08-31',
            opening: '100.000',
            receipts: '0.000',
            adjustments: '0.000',
            issuances: '30.000',
            netMovement: '-30.000',
            closing: '70.000',
          },
        ]),
      ),
    },
    drivers: {
      findIncludingDeletedByPublicId: vi.fn(() => Promise.resolve(refs.driver)),
      findCurrentByPublicIdForUpdate: vi.fn(() => {
        lockOrder.push('driver');
        return Promise.resolve(refs.driver);
      }),
      listOperational: vi.fn(() =>
        Promise.resolve({
          items: [{ publicId: refs.driver.publicId.toString(), name: refs.driver.name.toString() }],
          nextCursor: null,
          previousCursor: null,
        }),
      ),
    },
    vehicles: {
      findIncludingDeletedByPublicId: vi.fn(() => Promise.resolve(refs.vehicle)),
      findCurrentByPublicIdForUpdate: vi.fn(() => {
        lockOrder.push('vehicle');
        return Promise.resolve(refs.vehicle);
      }),
      listOperational: vi.fn(() =>
        Promise.resolve({
          items: [
            {
              publicId: refs.vehicle.publicId.toString(),
              label: `${refs.vehicle.plateNumber.toString()} — ${refs.vehicle.modelBrand.toString()}`,
              plateNumber: refs.vehicle.plateNumber.toString(),
              modelBrand: refs.vehicle.modelBrand.toString(),
              vehicleType: refs.vehicle.vehicleType.toString(),
            },
          ],
          nextCursor: null,
          previousCursor: null,
        }),
      ),
    },
    allocations: {
      findIncludingDeletedByPublicId: vi.fn(() => Promise.resolve(refs.allocation)),
      findCurrentByPublicIdForUpdate: vi.fn(() => {
        lockOrder.push('allocation');
        return Promise.resolve(refs.allocation);
      }),
      listOperational: vi.fn(() => {
        return Promise.resolve({
          items: [
            {
              publicId: refs.allocation.publicId.toString(),
              ppmpNumber: refs.allocation.ppmpNumber.toString(),
              office: {
                publicId: refs.office.publicId.toString(),
                name: refs.office.name.toString(),
                abbreviation: refs.office.abbreviation.toString(),
              },
              quarter: refs.allocation.quarter.toNumber(),
              fiscalYear: refs.allocation.fiscalYear.toNumber(),
            },
          ],
          nextCursor: null,
          previousCursor: null,
        });
      }),
    },
    offices: {
      findIncludingDeletedByPublicId: vi.fn(() => Promise.resolve(refs.office)),
      findCurrentByPublicIdForUpdate: vi.fn(() => {
        lockOrder.push('office');
        return Promise.resolve(refs.office);
      }),
    },
    auditEvents: {
      append: vi.fn((event: unknown) => {
        audits.push(event);
        return Promise.resolve();
      }),
    },
  } as unknown as FuelRepositories;
  const dependencies: FuelUseCaseDependencies = {
    transaction: { execute: (work) => work(repositories) },
    permissions: new FuelPermissionPolicy(),
    publicIds: { generate: () => id(generated++) },
    clock: { now: () => at },
    fiscalPeriodPolicy: new ManilaFiscalPeriodPolicy(),
  };
  return { dependencies, repositories, ledger, audits, lockOrder, getIssuance: () => issuance };
}

describe('fuel issuance use cases', () => {
  it('creates a validated draft with AOR as the default destination', async () => {
    const setup = harness();
    const result = await new CreateFuelIssuance(setup.dependencies).execute({ context, command });

    expect(result).toMatchObject({
      destination: 'AOR',
      status: 'DRAFT',
      vehicle: { vehicleType: 'Passenger Van' },
    });
    expect(setup.audits).toHaveLength(1);
  });

  it('updates only a draft and records before-and-after snapshots', async () => {
    const setup = harness();
    const created = await new CreateFuelIssuance(setup.dependencies).execute({ context, command });
    const result = await new UpdateDraftFuelIssuance(setup.dependencies).execute({
      context,
      publicId: created.publicId,
      command: { ...command, purpose: 'Updated field operations' },
    });

    expect(result.purpose).toBe('Updated field operations');
    expect(setup.audits).toHaveLength(2);
  });

  it('posts with the fixed lock order and appends one negative issuance entry', async () => {
    const setup = harness();
    const created = await new CreateFuelIssuance(setup.dependencies).execute({ context, command });
    setup.lockOrder.length = 0;
    const result = await new PostFuelIssuance(setup.dependencies).execute({
      context,
      publicId: created.publicId,
      command: { issuedLiters: '30' },
    });

    expect(setup.lockOrder).toEqual([
      'issuance',
      'sequence',
      'driver',
      'vehicle',
      'allocation',
      'office',
    ]);
    expect(result).toMatchObject({
      risNumber: '2026-08-007',
      totalAmount: '1837.50',
      status: 'POSTED',
    });
    expect(setup.ledger).toHaveLength(1);
    expect(setup.ledger[0]).toMatchObject({ transactionType: 'ISSUANCE' });
  });

  it('voids a posted issuance by appending a positive compensation entry', async () => {
    const setup = harness();
    const created = await new CreateFuelIssuance(setup.dependencies).execute({ context, command });
    await new PostFuelIssuance(setup.dependencies).execute({
      context,
      publicId: created.publicId,
      command: { issuedLiters: '30' },
    });
    setup.ledger.length = 0;
    const result = await new VoidFuelIssuance(setup.dependencies).execute({
      context,
      publicId: created.publicId,
      command: { reason: 'Duplicate dispatch entry' },
    });

    expect(result).toMatchObject({ status: 'VOIDED', voidReason: 'Duplicate dispatch entry' });
    expect(setup.ledger[0]).toMatchObject({ transactionType: 'ADJUSTMENT' });
  });

  it('returns inclusive balance summaries for readers', async () => {
    const setup = harness();
    const result = await new GetFuelBalances(setup.dependencies).execute({
      context,
      query: { startDate: '2026-08-01', endDate: '2026-08-31', fuelType: 'DIESEL' },
    });
    expect(result[0]).toMatchObject({ opening: '100.000', closing: '70.000' });
  });

  it('loads one issuance detail with its ledger history', async () => {
    const setup = harness();
    const created = await new CreateFuelIssuance(setup.dependencies).execute({ context, command });

    const result = await new GetFuelIssuance(setup.dependencies).execute({
      context,
      publicId: created.publicId,
    });

    expect(result).toMatchObject({ publicId: created.publicId, ledgerEntries: [] });
  });

  it('lists mapped issuance records with cursor metadata', async () => {
    const setup = harness();
    const created = await new CreateFuelIssuance(setup.dependencies).execute({ context, command });

    const result = await new ListFuelIssuances(setup.dependencies).execute({
      context,
      query: {
        query: null,
        status: null,
        fuelType: null,
        startDate: null,
        endDate: null,
        cursor: null,
        pageSize: 25,
      },
    });

    expect(result).toMatchObject({
      items: [{ publicId: created.publicId, purchaseRequestNumber: 'PR-2026-001' }],
      nextCursor: null,
      previousCursor: null,
    });
  });

  it('loads operational preparation options for the entry-date fiscal period', async () => {
    const setup = harness();

    const result = await new GetFuelPreparationOptions(setup.dependencies).execute({
      context,
      entryDate: '2026-08-28',
    });

    expect(result.drivers).toHaveLength(1);
    expect(result.vehicles).toHaveLength(1);
    expect(result.allocations).toHaveLength(1);
    expect(setup.repositories.allocations.listOperational).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveDate: '2026-08-28', fiscalYear: 2026, quarter: 3 }),
    );
  });

  it('rejects invalid preparation and balance date ranges', async () => {
    const setup = harness();

    await expect(
      new GetFuelPreparationOptions(setup.dependencies).execute({
        context,
        entryDate: 'not-a-date',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      new GetFuelBalances(setup.dependencies).execute({
        context,
        query: { startDate: '2026-08-31', endDate: '2026-08-01', fuelType: null },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
