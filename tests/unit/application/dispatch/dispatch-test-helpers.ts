import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { DispatchReferenceRecord } from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchRepository } from '@/application/dispatch/ports/dispatch-repository';
import type { DispatchRepositories } from '@/application/dispatch/ports/dispatch-transaction';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import type { DriverRepository } from '@/application/driver/ports/driver-repository';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import type { VehicleRepository } from '@/application/vehicle/ports/vehicle-repository';
import { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';

export const publicId = (value: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(value).padStart(12, '0')}`);
export const testAt = new Date('2026-08-29T00:00:00.000Z');

export const context = {
  principal: {
    userPublicId: publicId(801).toString(),
    username: 'dispatch.officer',
    fullName: 'Dispatch Officer',
    roles: ['DISPATCH_OFFICER'],
    permissions: [
      'dispatch.create',
      'dispatch.read',
      'dispatch.update',
      'dispatch.complete',
      'dispatch.cancel',
    ],
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  },
  requestId: 'request-fvd-007',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
} as const;

export const command = {
  entryDate: '2026-08-29',
  travelDate: '2026-08-28',
  driverPublicId: publicId(803).toString(),
  vehiclePublicId: publicId(804).toString(),
  requestingOfficePublicId: publicId(802).toString(),
  destination: 'District Hospital',
  purpose: 'Deliver medical supplies',
  odoBefore: '1250.4',
  passengerCount: 2,
} as const;

export interface DispatchHarness {
  readonly dependencies: DispatchUseCaseDependencies;
  readonly repositories: DispatchRepositories;
  readonly lockOrder: string[];
  readonly audits: AuditEventInput[];
  readonly office: Office;
  readonly driver: Driver;
  readonly vehicle: Vehicle;
  setDispatch(dispatch: VehicleDispatch): void;
  getDispatch(): VehicleDispatch | null;
}

export function createDraft(): VehicleDispatch {
  return new VehicleDispatch({
    publicId: publicId(805),
    entryDate: DispatchDate.from(command.entryDate),
    travelDate: DispatchDate.from(command.travelDate),
    driverPublicId: publicId(803),
    vehiclePublicId: publicId(804),
    requestingOfficePublicId: publicId(802),
    destination: command.destination,
    purpose: command.purpose,
    odoBefore: OdometerReading.from(command.odoBefore),
    passengerCount: PassengerCount.from(command.passengerCount),
    createdByActorPublicId: publicId(801),
    createdAt: testAt,
    updatedAt: testAt,
  });
}

export function createHarness(): DispatchHarness {
  const lockOrder: string[] = [];
  const audits: AuditEventInput[] = [];
  const office = new Office({
    publicId: publicId(802),
    name: OfficeName.from('Provincial Services Office'),
    abbreviation: OfficeAbbreviation.from('PSO'),
    createdAt: testAt,
    updatedAt: testAt,
  });
  const driver = new Driver({
    publicId: publicId(803),
    name: DriverName.from('Juan Dela Cruz'),
    contactNumber: DriverContactNumber.optional('09171234567'),
    createdAt: testAt,
    updatedAt: testAt,
  });
  const vehicle = new Vehicle({
    publicId: publicId(804),
    modelBrand: ModelBrand.from('Toyota Hiace'),
    vehicleType: VehicleType.from('Passenger Van'),
    plateNumber: PlateNumber.from('ABC-123'),
    remarks: VehicleRemarks.optional('Pool vehicle'),
    createdAt: testAt,
    updatedAt: testAt,
  });
  let current: VehicleDispatch | null = null;

  const record = (): DispatchReferenceRecord | null =>
    current === null
      ? null
      : {
          dispatch: current,
          driver: { publicId: driver.publicId.toString(), name: driver.name.toString() },
          vehicle: {
            publicId: vehicle.publicId.toString(),
            plateNumber: vehicle.plateNumber.toString(),
            modelBrand: vehicle.modelBrand.toString(),
            vehicleType: vehicle.vehicleType.toString(),
          },
          requestingOffice: {
            publicId: office.publicId.toString(),
            name: office.name.toString(),
            abbreviation: office.abbreviation.toString(),
          },
        };

  const dispatches: DispatchRepository = {
    async findByPublicId() {
      return record();
    },
    async findByPublicIdForUpdate() {
      lockOrder.push('dispatch');
      return current;
    },
    async insert(dispatch) {
      current = dispatch;
    },
    async updateDetails(dispatch) {
      current = dispatch;
    },
    async updateLifecycle(dispatch) {
      current = dispatch;
    },
    async list(query) {
      return {
        items: record() === null || query.status === 'COMPLETED' ? [] : [record()!],
        nextCursor: null,
        previousCursor: null,
      };
    },
  };

  const offices = {
    async findCurrentByPublicIdForUpdate() {
      lockOrder.push('office');
      return office;
    },
    async findIncludingDeletedByPublicId() {
      return office;
    },
    async listOperational() {
      return {
        items: [
          {
            publicId: office.publicId.toString(),
            name: office.name.toString(),
            abbreviation: office.abbreviation.toString(),
          },
        ],
        nextCursor: null,
        previousCursor: null,
      };
    },
  } as unknown as OfficeRepository;
  const drivers = {
    async findCurrentByPublicIdForUpdate() {
      lockOrder.push('driver');
      return driver;
    },
    async findIncludingDeletedByPublicId() {
      return driver;
    },
    async listOperational() {
      return {
        items: [{ publicId: driver.publicId.toString(), name: driver.name.toString() }],
        nextCursor: null,
        previousCursor: null,
      };
    },
  } as unknown as DriverRepository;
  const vehicles = {
    async findCurrentByPublicIdForUpdate() {
      lockOrder.push('vehicle');
      return vehicle;
    },
    async findIncludingDeletedByPublicId() {
      return vehicle;
    },
    async listOperational() {
      return {
        items: [
          {
            publicId: vehicle.publicId.toString(),
            label: `${vehicle.plateNumber.toString()} — ${vehicle.modelBrand.toString()}`,
            plateNumber: vehicle.plateNumber.toString(),
            modelBrand: vehicle.modelBrand.toString(),
            vehicleType: vehicle.vehicleType.toString(),
          },
        ],
        nextCursor: null,
        previousCursor: null,
      };
    },
  } as unknown as VehicleRepository;

  const repositories: DispatchRepositories = {
    dispatches,
    offices,
    drivers,
    vehicles,
    auditEvents: {
      async append(event) {
        audits.push(event);
      },
    },
  };
  let nextPublicId = 900;
  const dependencies: DispatchUseCaseDependencies = {
    transaction: {
      async execute(work) {
        return work(repositories);
      },
    },
    permissions: new DispatchPermissionPolicy(),
    publicIds: { generate: () => publicId(nextPublicId++) },
    clock: { now: () => testAt },
  };

  return {
    dependencies,
    repositories,
    lockOrder,
    audits,
    office,
    driver,
    vehicle,
    setDispatch(dispatch) {
      current = dispatch;
    },
    getDispatch() {
      return current;
    },
  };
}
