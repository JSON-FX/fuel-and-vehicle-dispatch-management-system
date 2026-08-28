import type { Kysely } from 'kysely';

import { CreateDriver } from '@/application/driver/use-cases/create-driver';
import { GetDriver } from '@/application/driver/use-cases/get-driver';
import { ListDrivers } from '@/application/driver/use-cases/list-drivers';
import { ListOperationalDriverOptions } from '@/application/driver/use-cases/list-operational-driver-options';
import { RestoreDriver } from '@/application/driver/use-cases/restore-driver';
import { SoftDeleteDriver } from '@/application/driver/use-cases/soft-delete-driver';
import { UpdateDriver } from '@/application/driver/use-cases/update-driver';
import { MasterDataPermissionPolicy } from '@/application/master-data/services/master-data-permission-policy';
import { CreateOffice } from '@/application/office/use-cases/create-office';
import { GetOffice } from '@/application/office/use-cases/get-office';
import { ListOffices } from '@/application/office/use-cases/list-offices';
import { ListOperationalOfficeOptions } from '@/application/office/use-cases/list-operational-office-options';
import { RestoreOffice } from '@/application/office/use-cases/restore-office';
import { SoftDeleteOffice } from '@/application/office/use-cases/soft-delete-office';
import { UpdateOffice } from '@/application/office/use-cases/update-office';
import type { Clock } from '@/application/auth/ports/clock';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { CreateVehicle } from '@/application/vehicle/use-cases/create-vehicle';
import { GetVehicle } from '@/application/vehicle/use-cases/get-vehicle';
import { ListOperationalVehicleOptions } from '@/application/vehicle/use-cases/list-operational-vehicle-options';
import { ListVehicles } from '@/application/vehicle/use-cases/list-vehicles';
import { RestoreVehicle } from '@/application/vehicle/use-cases/restore-vehicle';
import { SoftDeleteVehicle } from '@/application/vehicle/use-cases/soft-delete-vehicle';
import { UpdateVehicle } from '@/application/vehicle/use-cases/update-vehicle';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { KyselyMasterDataTransaction } from '@/infrastructure/database/master-data/kysely-master-data-transaction';
import type { Database } from '@/infrastructure/database/types';

export interface MasterDataWebComposition {
  readonly masterDataPermissions: MasterDataPermissionPolicy;
  readonly createOffice: CreateOffice;
  readonly getOffice: GetOffice;
  readonly listOffices: ListOffices;
  readonly listOperationalOfficeOptions: ListOperationalOfficeOptions;
  readonly updateOffice: UpdateOffice;
  readonly softDeleteOffice: SoftDeleteOffice;
  readonly restoreOffice: RestoreOffice;
  readonly createDriver: CreateDriver;
  readonly getDriver: GetDriver;
  readonly listDrivers: ListDrivers;
  readonly listOperationalDriverOptions: ListOperationalDriverOptions;
  readonly updateDriver: UpdateDriver;
  readonly softDeleteDriver: SoftDeleteDriver;
  readonly restoreDriver: RestoreDriver;
  readonly createVehicle: CreateVehicle;
  readonly getVehicle: GetVehicle;
  readonly listVehicles: ListVehicles;
  readonly listOperationalVehicleOptions: ListOperationalVehicleOptions;
  readonly updateVehicle: UpdateVehicle;
  readonly softDeleteVehicle: SoftDeleteVehicle;
  readonly restoreVehicle: RestoreVehicle;
}

export function createMasterDataWebComposition(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions,
  dependencies: { readonly publicIds: PublicIdGenerator; readonly clock: Clock },
): MasterDataWebComposition {
  const transaction = new KyselyMasterDataTransaction(database, auditOptions);
  const permissions = new MasterDataPermissionPolicy();
  const common = { transaction, permissions, ...dependencies } as const;
  return Object.freeze({
    masterDataPermissions: permissions,
    createOffice: new CreateOffice(common),
    getOffice: new GetOffice(common),
    listOffices: new ListOffices(common),
    listOperationalOfficeOptions: new ListOperationalOfficeOptions(common),
    updateOffice: new UpdateOffice(common),
    softDeleteOffice: new SoftDeleteOffice(common),
    restoreOffice: new RestoreOffice(common),
    createDriver: new CreateDriver(common),
    getDriver: new GetDriver(common),
    listDrivers: new ListDrivers(common),
    listOperationalDriverOptions: new ListOperationalDriverOptions(common),
    updateDriver: new UpdateDriver(common),
    softDeleteDriver: new SoftDeleteDriver(common),
    restoreDriver: new RestoreDriver(common),
    createVehicle: new CreateVehicle(common),
    getVehicle: new GetVehicle(common),
    listVehicles: new ListVehicles(common),
    listOperationalVehicleOptions: new ListOperationalVehicleOptions(common),
    updateVehicle: new UpdateVehicle(common),
    softDeleteVehicle: new SoftDeleteVehicle(common),
    restoreVehicle: new RestoreVehicle(common),
  });
}
