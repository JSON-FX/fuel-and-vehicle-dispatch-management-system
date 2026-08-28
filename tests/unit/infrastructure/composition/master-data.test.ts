import { afterEach, describe, expect, it } from 'vitest';

import { createMasterDataWebComposition } from '@/infrastructure/composition/master-data';
import { createDatabaseClient } from '@/infrastructure/database/client';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

const databases: Array<{ destroy(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.destroy()));
});

describe('master-data composition', () => {
  it('constructs all resource use cases around one application database', () => {
    const database = createDatabaseClient({
      host: '127.0.0.1',
      port: 1,
      name: 'fvdms',
      user: 'fvdms_app',
      password: 'app-password',
      poolMin: 0,
      poolMax: 1,
      connectTimeoutMs: 50,
      queryTimeoutMs: 50,
    });
    databases.push(database);
    const composition = createMasterDataWebComposition(
      database,
      { primarySchema: 'fvdms_audit', maximumCanonicalPayloadBytes: 65_536 },
      { publicIds: new UuidV7Generator(), clock: { now: () => new Date() } },
    );

    expect(Object.isFrozen(composition)).toBe(true);
    expect(composition.masterDataPermissions.canRead).toBeTypeOf('function');
    expect(
      [
        composition.createOffice,
        composition.getOffice,
        composition.listOffices,
        composition.listOperationalOfficeOptions,
        composition.updateOffice,
        composition.softDeleteOffice,
        composition.restoreOffice,
        composition.createDriver,
        composition.getDriver,
        composition.listDrivers,
        composition.listOperationalDriverOptions,
        composition.updateDriver,
        composition.softDeleteDriver,
        composition.restoreDriver,
        composition.createVehicle,
        composition.getVehicle,
        composition.listVehicles,
        composition.listOperationalVehicleOptions,
        composition.updateVehicle,
        composition.softDeleteVehicle,
        composition.restoreVehicle,
      ].every((useCase) => typeof useCase.execute === 'function'),
    ).toBe(true);
  });
});
