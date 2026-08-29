import type { Kysely } from 'kysely';
import { escape } from 'mysql2';
import { createConnection, createPool, type Pool } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { NormalizedReportFilters, ReportType } from '@/application/reporting/dto/report-dtos';
import type { BootstrapEnvironment } from '@/infrastructure/config/environment';
import { createReportingRuntimeGrantStatements } from '@/infrastructure/database/bootstrap';
import type { Database } from '@/infrastructure/database/types';
import { KyselyReportQueryRepository } from '@/infrastructure/database/reporting/kysely-report-query-repository';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import {
  fuelPublicId,
  fuelTestAt,
  prepareFuelDatabase,
  resetFuelDatabase,
  seedFuelReferences,
} from '../helpers/fuel-test-database';
import { createTestDatabase } from '../helpers/test-database';
import type { TestDatabaseConfiguration } from '../helpers/test-database';

let database: Kysely<Database>;
let repository: KyselyReportQueryRepository;
let reportingPool: Pool;
let configuration: TestDatabaseConfiguration;

const reportingCredentials = {
  user: 'fvdms_reporting_integration',
  password: 'fvdms-reporting-integration-password',
} as const;

beforeAll(async () => {
  configuration = inject('mysql');
  database = createTestDatabase(configuration);
  await prepareFuelDatabase(database);
  reportingPool = await createReadOnlyReportingPool(configuration);
});

beforeEach(async () => {
  await resetFuelDatabase(database);
  repository = new KyselyReportQueryRepository(database);
});

afterAll(async () => {
  await Promise.all([database.destroy(), reportingPool.end()]);
});

function filters(
  reportType: ReportType,
  overrides: Partial<NormalizedReportFilters> = {},
): NormalizedReportFilters {
  return {
    reportType,
    requestingOfficePublicId: null,
    periodType: 'MONTHLY',
    referenceDate: '2026-08-15',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: null,
    cursor: null,
    pageSize: 100,
    ...overrides,
  };
}

async function seedReportingFacts(): Promise<{ officePublicId: string }> {
  const references = await seedFuelReferences(database);
  const [actor, office, driver, vehicle, allocation] = await Promise.all([
    database.selectFrom('users').select('id').executeTakeFirstOrThrow(),
    database
      .selectFrom('offices')
      .select('id')
      .where('public_id', '=', publicIdToBinary(references.office.publicId))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('drivers')
      .select('id')
      .where('public_id', '=', publicIdToBinary(references.driver.publicId))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('vehicles')
      .select('id')
      .where('public_id', '=', publicIdToBinary(references.vehicle.publicId))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('budget_allocations')
      .select('id')
      .where('public_id', '=', publicIdToBinary(references.allocation.publicId))
      .executeTakeFirstOrThrow(),
  ]);

  await database
    .insertInto('fuel_issuances')
    .values([
      {
        public_id: publicIdToBinary(fuelPublicId(640)),
        ris_number: 'RIS-202608-0001',
        purchase_request_number: 'PR-POSTED',
        entry_date: '2026-08-05',
        driver_id: driver.id,
        destination: 'District Hospital',
        purpose: 'Official delivery',
        vehicle_id: vehicle.id,
        requested_liters: '20.500',
        is_full_tank: false,
        issued_liters: '20.500',
        unit_price: '60.0000',
        total_amount: '1230.00',
        budget_allocation_id: allocation.id,
        fuel_type: 'DIESEL',
        status: 'POSTED',
        created_by_user_id: actor.id,
        posted_at: fuelTestAt,
        voided_at: null,
        voided_by_user_id: null,
        void_reason: null,
        created_at: fuelTestAt,
        updated_at: fuelTestAt,
      },
      {
        public_id: publicIdToBinary(fuelPublicId(641)),
        ris_number: 'RIS-202608-0002',
        purchase_request_number: 'PR-VOIDED',
        entry_date: '2026-08-06',
        driver_id: driver.id,
        destination: 'Provincial Capitol',
        purpose: 'Voided proof',
        vehicle_id: vehicle.id,
        requested_liters: '10.000',
        is_full_tank: false,
        issued_liters: '10.000',
        unit_price: '60.0000',
        total_amount: '600.00',
        budget_allocation_id: allocation.id,
        fuel_type: 'DIESEL',
        status: 'VOIDED',
        created_by_user_id: actor.id,
        posted_at: fuelTestAt,
        voided_at: fuelTestAt,
        voided_by_user_id: actor.id,
        void_reason: 'Integration proof',
        created_at: fuelTestAt,
        updated_at: fuelTestAt,
      },
    ])
    .execute();

  await database
    .insertInto('vehicle_dispatches')
    .values([
      {
        public_id: publicIdToBinary(fuelPublicId(650)),
        driver_id: driver.id,
        vehicle_id: vehicle.id,
        requesting_office_id: office.id,
        entry_date: '2026-08-04',
        travel_date: '2026-08-07',
        travel_start_at: fuelTestAt,
        travel_end_at: fuelTestAt,
        destination: 'Regional Office',
        purpose: 'Completed official travel',
        odo_before: '1000.0',
        odo_after: '1125.5',
        passenger_count: 4,
        status: 'COMPLETED',
        created_by_user_id: actor.id,
        dispatched_at: fuelTestAt,
        completed_at: fuelTestAt,
        cancelled_at: null,
        cancelled_by_user_id: null,
        cancellation_reason: null,
        created_at: fuelTestAt,
        updated_at: fuelTestAt,
      },
      {
        public_id: publicIdToBinary(fuelPublicId(651)),
        driver_id: driver.id,
        vehicle_id: vehicle.id,
        requesting_office_id: office.id,
        entry_date: '2026-08-05',
        travel_date: '2026-08-08',
        travel_start_at: fuelTestAt,
        travel_end_at: null,
        destination: 'Municipal Hall',
        purpose: 'Dispatched official travel',
        odo_before: '1125.5',
        odo_after: null,
        passenger_count: 2,
        status: 'DISPATCHED',
        created_by_user_id: actor.id,
        dispatched_at: fuelTestAt,
        completed_at: null,
        cancelled_at: null,
        cancelled_by_user_id: null,
        cancellation_reason: null,
        created_at: fuelTestAt,
        updated_at: fuelTestAt,
      },
    ])
    .execute();

  return { officePublicId: references.office.publicId.toString() };
}

describe('report query repository', () => {
  it('uses stored issuance values for detail and excludes voided fuel from summaries', async () => {
    await seedReportingFacts();

    const detail = await repository.getReport(
      filters('FUEL_ISSUANCE'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
    expect(detail.rows).toHaveLength(2);
    expect(detail.rows[0]).toMatchObject({
      reportType: 'FUEL_ISSUANCE',
      status: 'VOIDED',
      issuedLiters: '10.000',
      unitPrice: '60.0000',
      totalAmount: '600.00',
    });

    const summary = await repository.getReport(
      filters('FUEL_BY_OFFICE'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
    expect(summary.rows).toEqual([
      expect.objectContaining({
        reportType: 'FUEL_BY_OFFICE',
        issuanceCount: 1,
        issuedLiters: '20.500',
        totalAmount: '1230.00',
      }),
    ]);

    for (const reportType of [
      'FUEL_BY_VEHICLE',
      'FUEL_TYPE_TOTALS',
      'FUEL_AMOUNT_BY_PERIOD',
    ] as const) {
      const grouped = await repository.getReport(
        filters(reportType),
        new Date('2026-08-29T00:00:00.000Z'),
      );
      expect(grouped.rows).toHaveLength(1);
      expect(grouped.rows[0]).toMatchObject({
        reportType,
        issuanceCount: 1,
        totalAmount: '1230.00',
      });
    }
  });

  it('uses travel dates and exact lifecycle evidence for dispatch summaries', async () => {
    await seedReportingFacts();

    const count = await repository.getReport(
      filters('DISPATCH_COUNT_BY_OFFICE'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
    expect(count.rows).toEqual([
      expect.objectContaining({ reportType: 'DISPATCH_COUNT_BY_OFFICE', dispatchCount: 2 }),
    ]);

    const utilization = await repository.getReport(
      filters('VEHICLE_UTILIZATION'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
    expect(utilization.rows).toEqual([
      expect.objectContaining({
        reportType: 'VEHICLE_UTILIZATION',
        completedTrips: 1,
        completedDistance: '125.5',
      }),
    ]);
  });

  it('groups posted activity by allocation without inventing budget ceilings', async () => {
    await seedReportingFacts();

    const activity = await repository.getReport(
      filters('BUDGET_ALLOCATION_ACTIVITY'),
      new Date('2026-08-29T00:00:00.000Z'),
    );
    expect(activity.rows).toEqual([
      expect.objectContaining({
        reportType: 'BUDGET_ALLOCATION_ACTIVITY',
        fiscalYear: 2026,
        quarter: 3,
        issuanceCount: 1,
        issuedLiters: '20.500',
        totalAmount: '1230.00',
      }),
    ]);
    expect(activity.rows[0]).not.toHaveProperty('remaining');
    expect(activity.rows[0]).not.toHaveProperty('percentage');
  });

  it('applies the same office and period predicates to estimates and streams', async () => {
    const fixture = await seedReportingFacts();
    const selected = filters('FUEL_ISSUANCE', {
      requestingOfficePublicId: fixture.officePublicId,
      status: 'POSTED',
    });
    const missing = filters('FUEL_ISSUANCE', {
      requestingOfficePublicId: fuelPublicId(999).toString(),
    });

    await expect(repository.estimateRows(selected, 100_000)).resolves.toBe(1);
    await expect(repository.estimateRows(missing, 100_000)).resolves.toBe(0);

    const streamed = [];
    for await (const row of repository.streamRows(selected)) streamed.push(row);
    expect(streamed).toHaveLength(1);
    expect(streamed[0]).toMatchObject({ reportType: 'FUEL_ISSUANCE', status: 'POSTED' });
  });

  it('caps estimates and returns active office filter options', async () => {
    const fixture = await seedReportingFacts();

    await expect(repository.estimateRows(filters('FUEL_ISSUANCE'), 1)).resolves.toBe(2);
    await expect(repository.getFilterOptions()).resolves.toEqual({
      offices: [
        {
          publicId: fixture.officePublicId,
          label: 'Provincial Services Office (PSO)',
        },
      ],
    });
  });

  it('allows the reporting identity to read sources but not mutate or inspect private jobs', async () => {
    await seedReportingFacts();

    await expect(reportingPool.query('SELECT COUNT(*) FROM offices')).resolves.toBeDefined();
    await expect(
      reportingPool.query('UPDATE offices SET office_name = office_name'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(reportingPool.query('SELECT * FROM export_jobs')).rejects.toMatchObject({
      code: 'ER_TABLEACCESS_DENIED_ERROR',
    });
  });
});

async function createReadOnlyReportingPool(input: TestDatabaseConfiguration): Promise<Pool> {
  const administrator = await createConnection({
    host: input.host,
    port: input.port,
    user: input.administratorUser,
    password: input.administratorPassword,
  });
  const account = `${escape(reportingCredentials.user)}@'%'`;
  try {
    await administrator.query(
      `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${escape(reportingCredentials.password)}`,
    );
    await administrator.query(
      `ALTER USER ${account} IDENTIFIED BY ${escape(reportingCredentials.password)}`,
    );
    await administrator.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${account}`);
    const environment = reportingBootstrapEnvironment(input);
    for (const statement of createReportingRuntimeGrantStatements(environment)) {
      await administrator.query(statement);
    }
  } finally {
    await administrator.end();
  }
  return createPool({
    host: input.host,
    port: input.port,
    database: input.database,
    user: reportingCredentials.user,
    password: reportingCredentials.password,
    connectionLimit: 1,
  });
}

function reportingBootstrapEnvironment(input: TestDatabaseConfiguration): BootstrapEnvironment {
  const unused = { user: 'unused', password: 'unused-password' };
  return {
    administrator: {
      host: input.host,
      port: input.port,
      user: input.administratorUser,
      password: input.administratorPassword,
    },
    database: { name: input.database },
    application: unused,
    migration: unused,
    reporting: reportingCredentials,
    audit: {
      primarySchema: 'fvdms_audit',
      sinkSchema: 'fvdms_audit_sink',
      worker: unused,
      sinkWriter: unused,
      verifier: unused,
    },
  };
}
