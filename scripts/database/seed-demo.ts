import { pathToFileURL } from 'node:url';

import Decimal from 'decimal.js';
import type { Kysely, Transaction } from 'kysely';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { getMigrationDatabase } from '@/infrastructure/database/client';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

const usage = 'Usage: seed-demo --count COUNT (COUNT must be an integer from 100 through 500).';
const markerKey = 'demo.seed.v1';
const officeNames = [
  'City Mayor Office',
  'City Engineering Office',
  'General Services Office',
  'City Health Office',
  'City Agriculture Office',
  'City Environment Office',
  'Disaster Risk Reduction Office',
  'City Social Welfare Office',
  'Public Safety Office',
  'City Budget Office',
  'City Treasurer Office',
  'City Planning Office',
] as const;
const driverFirstNames = [
  'Adrian',
  'Alvin',
  'Andres',
  'Carlo',
  'Daniel',
  'Eduardo',
  'Francis',
  'Gabriel',
  'Jerome',
  'Jose',
  'Manuel',
  'Ramon',
] as const;
const driverLastNames = ['Bautista', 'Cruz', 'Garcia'] as const;
const vehicleModels = [
  ['Toyota Hilux', 'Pickup'],
  ['Isuzu N-Series', 'Truck'],
  ['Toyota Hiace', 'Van'],
  ['Mitsubishi Strada', 'Pickup'],
  ['Ford Ranger', 'Pickup'],
  ['Nissan Urvan', 'Van'],
] as const;
const destinations = [
  'Barangay Operations Center',
  'City Materials Recovery Facility',
  'Regional Government Center',
  'Public Market Complex',
  'District Health Center',
  'Municipal Equipment Depot',
  'Emergency Operations Center',
  'Community Evacuation Site',
] as const;
const dispatchPurposes = [
  'Delivery of official supplies',
  'Field inspection and coordination',
  'Transport of operations personnel',
  'Emergency response support',
  'Collection of approved materials',
  'Scheduled maintenance support',
] as const;

export interface DemoSeedArguments {
  readonly count: number;
}

export interface DemoSeedPlan {
  readonly count: number;
  readonly dispatches: {
    readonly total: number;
    readonly draft: number;
    readonly dispatched: number;
    readonly completed: number;
    readonly cancelled: number;
  };
  readonly fuelIssuances: {
    readonly total: number;
    readonly draft: number;
    readonly posted: number;
    readonly voided: number;
  };
  readonly referenceDate: string;
}

export interface DemoSeedResult {
  readonly count: number;
  readonly fuelIssuances: number;
  readonly dispatches: number;
  readonly offices: number;
  readonly drivers: number;
  readonly vehicles: number;
  readonly budgetAllocations: number;
  readonly referenceDate: string;
}

export function parseDemoSeedArguments(arguments_: readonly string[]): DemoSeedArguments {
  const normalized = arguments_[0] === '--' ? arguments_.slice(1) : arguments_;
  if (normalized.length !== 2 || normalized[0] !== '--count') throw new Error(usage);
  const count = Number(normalized[1]);
  if (!Number.isInteger(count) || count < 100 || count > 500) throw new Error(usage);
  return { count };
}

export function assertDemoSeedEnvironment(environment: string | undefined): void {
  if (environment === 'production') {
    throw new Error('Demo data cannot be seeded when NODE_ENV is production.');
  }
}

export function buildDemoSeedPlan(count: number, now: Date): DemoSeedPlan {
  const fuelTotal = Math.ceil(count / 2);
  const dispatchTotal = count - fuelTotal;
  const fuelStatuses = countStatuses(fuelTotal, fuelStatus);
  const dispatchStatuses = countStatuses(dispatchTotal, dispatchStatus);
  return {
    count,
    dispatches: {
      total: dispatchTotal,
      draft: dispatchStatuses.DRAFT ?? 0,
      dispatched: dispatchStatuses.DISPATCHED ?? 0,
      completed: dispatchStatuses.COMPLETED ?? 0,
      cancelled: dispatchStatuses.CANCELLED ?? 0,
    },
    fuelIssuances: {
      total: fuelTotal,
      draft: fuelStatuses.DRAFT ?? 0,
      posted: fuelStatuses.POSTED ?? 0,
      voided: fuelStatuses.VOIDED ?? 0,
    },
    referenceDate: manilaCivilDate(now),
  };
}

export async function seedDemoData(
  database: Kysely<Database>,
  input: { readonly count: number; readonly now: Date },
): Promise<DemoSeedResult> {
  const plan = buildDemoSeedPlan(input.count, input.now);
  const publicIds = new UuidV7Generator();
  return database.transaction().execute(async (transaction) => {
    const existingMarker = await transaction
      .selectFrom('application_metadata')
      .select('id')
      .where('metadata_key', '=', markerKey)
      .executeTakeFirst();
    if (existingMarker !== undefined) {
      throw new Error(
        'Demo data has already been seeded. Run the guarded database reset before seeding again.',
      );
    }

    const actor = await findSeedActor(transaction);
    const masterData = await insertMasterData(transaction, publicIds, input.now);
    const allocations = await insertBudgetAllocations(
      transaction,
      publicIds,
      masterData.offices,
      plan.referenceDate,
      input.now,
    );
    await insertFuelIssuances(
      transaction,
      publicIds,
      plan.fuelIssuances.total,
      plan.referenceDate,
      actor.id,
      masterData,
      allocations,
      input.now,
    );
    await insertDispatches(
      transaction,
      publicIds,
      plan.dispatches.total,
      plan.referenceDate,
      actor.id,
      masterData,
      input.now,
    );

    const result: DemoSeedResult = {
      count: plan.count,
      fuelIssuances: plan.fuelIssuances.total,
      dispatches: plan.dispatches.total,
      offices: masterData.offices.length,
      drivers: masterData.drivers.length,
      vehicles: masterData.vehicles.length,
      budgetAllocations: allocations.size,
      referenceDate: plan.referenceDate,
    };
    await transaction
      .insertInto('application_metadata')
      .values({
        public_id: newPublicId(publicIds),
        metadata_key: markerKey,
        metadata_value: JSON.stringify({ ...result, synthetic: true }),
        created_at: input.now,
        updated_at: input.now,
      })
      .execute();
    return result;
  });
}

function fuelStatus(index: number): 'DRAFT' | 'POSTED' | 'VOIDED' {
  const position = index % 10;
  if (position === 0) return 'DRAFT';
  if (position === 1) return 'VOIDED';
  return 'POSTED';
}

function dispatchStatus(index: number): 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED' {
  const position = index % 10;
  if (position === 0) return 'DRAFT';
  if (position <= 2) return 'DISPATCHED';
  if (position === 3) return 'CANCELLED';
  return 'COMPLETED';
}

function countStatuses(total: number, resolve: (index: number) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let index = 0; index < total; index += 1) {
    const status = resolve(index);
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function manilaCivilDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

interface InternalRecord {
  readonly id: string;
  readonly abbreviation?: string;
}

interface DemoMasterData {
  readonly offices: readonly InternalRecord[];
  readonly drivers: readonly InternalRecord[];
  readonly vehicles: readonly InternalRecord[];
}

async function findSeedActor(transaction: Transaction<Database>): Promise<{ readonly id: string }> {
  const actor = await transaction
    .selectFrom('users')
    .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .select('users.id')
    .where('roles.code', '=', 'SUPER_ADMIN')
    .where('roles.is_active', '=', 1)
    .where('users.is_active', '=', 1)
    .where('users.deleted_at', 'is', null)
    .orderBy('users.id')
    .executeTakeFirst();
  if (actor === undefined) {
    throw new Error(
      'An active SUPER_ADMIN is required as the demo seed actor. Create the initial administrator first.',
    );
  }
  return actor;
}

async function insertMasterData(
  transaction: Transaction<Database>,
  publicIds: UuidV7Generator,
  now: Date,
): Promise<DemoMasterData> {
  const officeRows = officeNames.map((name, index) => ({
    public_id: newPublicId(publicIds),
    office_name: `${name} [Demo]`,
    abbreviation: `DMO-${String(index + 1).padStart(2, '0')}`,
    status: 'ACTIVE' as const,
    deleted_at: null,
    deleted_by_user_id: null,
    delete_reason: null,
    created_at: now,
    updated_at: now,
  }));
  const driverRows = driverFirstNames.flatMap((firstName) =>
    driverLastNames.map((lastName, lastIndex) => ({
      public_id: newPublicId(publicIds),
      full_name: `${firstName} ${lastName} [Demo]`,
      contact_no: `+63 917 55${String(driverFirstNames.indexOf(firstName)).padStart(2, '0')}${String(lastIndex).padStart(2, '0')}`,
      status: 'ACTIVE' as const,
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason: null,
      created_at: now,
      updated_at: now,
    })),
  );
  const vehicleRows = Array.from({ length: 24 }, (_, index) => {
    const model = vehicleModels[index % vehicleModels.length]!;
    return {
      public_id: newPublicId(publicIds),
      model_brand: model[0],
      vehicle_type: model[1],
      plate_no: `DMO-${String(index + 1).padStart(4, '0')}`,
      status: 'SERVICEABLE' as const,
      remarks: 'Synthetic demonstration record',
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason: null,
      created_at: now,
      updated_at: now,
    };
  });

  await transaction.insertInto('offices').values(officeRows).execute();
  await transaction.insertInto('drivers').values(driverRows).execute();
  await transaction.insertInto('vehicles').values(vehicleRows).execute();

  const [offices, drivers, vehicles] = await Promise.all([
    transaction
      .selectFrom('offices')
      .select(['id', 'abbreviation'])
      .where(
        'public_id',
        'in',
        officeRows.map((row) => row.public_id),
      )
      .orderBy('abbreviation')
      .execute(),
    transaction
      .selectFrom('drivers')
      .select('id')
      .where(
        'public_id',
        'in',
        driverRows.map((row) => row.public_id),
      )
      .orderBy('full_name')
      .execute(),
    transaction
      .selectFrom('vehicles')
      .select('id')
      .where(
        'public_id',
        'in',
        vehicleRows.map((row) => row.public_id),
      )
      .orderBy('plate_no')
      .execute(),
  ]);
  return { offices, drivers, vehicles };
}

async function insertBudgetAllocations(
  transaction: Transaction<Database>,
  publicIds: UuidV7Generator,
  offices: readonly InternalRecord[],
  referenceDate: string,
  now: Date,
): Promise<Map<string, InternalRecord>> {
  const referenceYear = Number(referenceDate.slice(0, 4));
  const referenceQuarter = quarterFor(referenceDate);
  const rows = offices.flatMap((office) =>
    [referenceYear - 1, referenceYear].flatMap((year) =>
      [1, 2, 3, 4].map((quarter) => ({
        public_id: newPublicId(publicIds),
        ppmp_number: `DEMO-${year}-Q${quarter}-${office.abbreviation}`,
        office_id: office.id,
        quarter,
        fiscal_year: year,
        status:
          year === referenceYear && quarter === referenceQuarter
            ? ('ACTIVE' as const)
            : ('CLOSED' as const),
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        created_at: now,
        updated_at: now,
      })),
    ),
  );
  await transaction.insertInto('budget_allocations').values(rows).execute();
  const stored = await transaction
    .selectFrom('budget_allocations')
    .select(['id', 'office_id', 'fiscal_year', 'quarter'])
    .where(
      'public_id',
      'in',
      rows.map((row) => row.public_id),
    )
    .execute();
  return new Map(
    stored.map((row) => [allocationKey(row.office_id, row.fiscal_year, row.quarter), row]),
  );
}

async function insertFuelIssuances(
  transaction: Transaction<Database>,
  publicIds: UuidV7Generator,
  total: number,
  referenceDate: string,
  actorId: string,
  masterData: DemoMasterData,
  allocations: ReadonlyMap<string, InternalRecord>,
  now: Date,
): Promise<void> {
  const existingSequences = await transaction
    .selectFrom('fuel_sequence_monthly')
    .select(['id', 'sequence_year', 'sequence_month', 'last_number'])
    .forUpdate()
    .execute();
  const sequenceValues = new Map(
    existingSequences.map((row) => [
      `${row.sequence_year}-${row.sequence_month}`,
      Number(row.last_number),
    ]),
  );
  const existingSequenceKeys = new Set(sequenceValues.keys());
  const plannedRows = Array.from({ length: total }, (_, index) => {
    const status = fuelStatus(index);
    const date =
      status === 'DRAFT' ? referenceDate : shiftCivilDate(referenceDate, -((index * 13) % 365));
    const office = masterData.offices[index % masterData.offices.length]!;
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const allocation = allocations.get(allocationKey(office.id, year, quarterFor(date)));
    if (allocation === undefined) throw new Error('A demo allocation is unavailable.');
    const fuelType = index % 2 === 0 ? ('DIESEL' as const) : ('GASOLINE' as const);
    const fullTank = index % 9 === 0;
    const issuedLiters = new Decimal(32).plus(new Decimal(index % 16).mul('2.25'));
    const unitPrice = new Decimal(fuelType === 'DIESEL' ? '62.50' : '68.25').plus(
      new Decimal(index % 5).mul('0.35'),
    );
    const createdAt = instantForCivilDate(date, 0);
    let risNumber: string | null = null;
    if (status !== 'DRAFT') {
      const sequenceKey = `${year}-${month}`;
      const next = (sequenceValues.get(sequenceKey) ?? 0) + 1;
      sequenceValues.set(sequenceKey, next);
      risNumber = `${year}-${String(month).padStart(2, '0')}-${String(next).padStart(3, '0')}`;
    }
    const publicId = newPublicId(publicIds);
    return {
      publicId,
      status,
      date,
      fuelType,
      issuedLiters: issuedLiters.toFixed(3),
      risNumber,
      row: {
        public_id: publicId,
        ris_number: risNumber,
        purchase_request_number: `DEMO-PR-${year}-${String(index + 1).padStart(4, '0')}`,
        entry_date: date,
        driver_id: masterData.drivers[index % masterData.drivers.length]!.id,
        destination: destinations[index % destinations.length]!,
        purpose: `Demo fuel support for ${dispatchPurposes[index % dispatchPurposes.length]!.toLowerCase()}`,
        vehicle_id: masterData.vehicles[index % masterData.vehicles.length]!.id,
        requested_liters: fullTank ? null : issuedLiters.plus(5).toFixed(3),
        is_full_tank: fullTank,
        issued_liters: status === 'DRAFT' ? null : issuedLiters.toFixed(3),
        unit_price: unitPrice.toFixed(2),
        total_amount:
          status === 'DRAFT' ? null : issuedLiters.mul(unitPrice).toDecimalPlaces(2).toFixed(2),
        budget_allocation_id: allocation.id,
        fuel_type: fuelType,
        status,
        created_by_user_id: actorId,
        posted_at: status === 'DRAFT' ? null : new Date(createdAt.getTime() + 7_200_000),
        voided_at: status === 'VOIDED' ? new Date(createdAt.getTime() + 10_800_000) : null,
        voided_by_user_id: status === 'VOIDED' ? actorId : null,
        void_reason: status === 'VOIDED' ? 'Synthetic void for demonstration history' : null,
        created_at: createdAt,
        updated_at:
          status === 'VOIDED'
            ? new Date(createdAt.getTime() + 10_800_000)
            : status === 'POSTED'
              ? new Date(createdAt.getTime() + 7_200_000)
              : createdAt,
      },
    };
  });
  await transaction
    .insertInto('fuel_issuances')
    .values(plannedRows.map((planned) => planned.row))
    .execute();

  const storedIssuances = await transaction
    .selectFrom('fuel_issuances')
    .select(['id', 'public_id'])
    .where(
      'public_id',
      'in',
      plannedRows.map((planned) => planned.publicId),
    )
    .execute();
  const issuanceIds = new Map(
    storedIssuances.map((row) => [row.public_id.toString('hex'), row.id]),
  );
  const ledgerRows = [
    ...(['DIESEL', 'GASOLINE'] as const).map((fuelType) => ({
      public_id: newPublicId(publicIds),
      fuel_issuance_id: null,
      fuel_type: fuelType,
      transaction_type: 'OPENING' as const,
      quantity: '50000.000',
      signed_quantity: '50000.000',
      effective_date: shiftCivilDate(referenceDate, -365),
      reference: `DEMO-OPENING-${fuelType}-${referenceDate}`,
      occurred_at: instantForCivilDate(shiftCivilDate(referenceDate, -365), 0),
      created_at: now,
    })),
    ...plannedRows.flatMap((planned) => {
      if (planned.status === 'DRAFT') return [];
      const issuanceId = issuanceIds.get(planned.publicId.toString('hex'));
      if (issuanceId === undefined || planned.risNumber === null) {
        throw new Error('A seeded fuel issuance could not be resolved.');
      }
      const issuedAt = instantForCivilDate(planned.date, 2);
      const issuance = {
        public_id: newPublicId(publicIds),
        fuel_issuance_id: issuanceId,
        fuel_type: planned.fuelType,
        transaction_type: 'ISSUANCE' as const,
        quantity: planned.issuedLiters,
        signed_quantity: `-${planned.issuedLiters}`,
        effective_date: planned.date,
        reference: planned.risNumber,
        occurred_at: issuedAt,
        created_at: issuedAt,
      };
      if (planned.status !== 'VOIDED') return [issuance];
      const voidedAt = new Date(issuedAt.getTime() + 3_600_000);
      return [
        issuance,
        {
          ...issuance,
          public_id: newPublicId(publicIds),
          transaction_type: 'ADJUSTMENT' as const,
          signed_quantity: planned.issuedLiters,
          reference: `VOID-${planned.risNumber}`,
          occurred_at: voidedAt,
          created_at: voidedAt,
        },
      ];
    }),
  ];
  await transaction.insertInto('fuel_ledger_entries').values(ledgerRows).execute();

  for (const [key, lastNumber] of sequenceValues) {
    const [yearText, monthText] = key.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (existingSequenceKeys.has(key)) {
      await transaction
        .updateTable('fuel_sequence_monthly')
        .set({ last_number: lastNumber, updated_at: now })
        .where('sequence_year', '=', year)
        .where('sequence_month', '=', month)
        .execute();
    } else {
      await transaction
        .insertInto('fuel_sequence_monthly')
        .values({
          sequence_year: year,
          sequence_month: month,
          last_number: lastNumber,
          created_at: now,
          updated_at: now,
        })
        .execute();
    }
  }
}

async function insertDispatches(
  transaction: Transaction<Database>,
  publicIds: UuidV7Generator,
  total: number,
  referenceDate: string,
  actorId: string,
  masterData: DemoMasterData,
  now: Date,
): Promise<void> {
  const rows = Array.from({ length: total }, (_, index) => {
    const status = dispatchStatus(index);
    const date =
      status === 'DRAFT'
        ? shiftCivilDate(referenceDate, (index % 14) + 1)
        : shiftCivilDate(referenceDate, -((index * 7) % 330));
    const startAt = instantForCivilDate(date, 0);
    const dispatchedAt = new Date(startAt.getTime() - 1_800_000);
    const completedAt = new Date(startAt.getTime() + 14_400_000);
    const cancelledAt = new Date(startAt.getTime() - 3_600_000);
    const odoBefore = new Decimal(10_000).plus(new Decimal(index).mul('125.5'));
    return {
      public_id: newPublicId(publicIds),
      driver_id: masterData.drivers[index % masterData.drivers.length]!.id,
      vehicle_id: masterData.vehicles[index % masterData.vehicles.length]!.id,
      requesting_office_id: masterData.offices[index % masterData.offices.length]!.id,
      entry_date: status === 'DRAFT' ? referenceDate : date,
      travel_date: date,
      travel_start_at: status === 'DRAFT' ? null : startAt,
      travel_end_at: status === 'COMPLETED' ? completedAt : null,
      destination: destinations[index % destinations.length]!,
      purpose: `${dispatchPurposes[index % dispatchPurposes.length]} [Demo]`,
      odo_before: odoBefore.toFixed(1),
      odo_after:
        status === 'COMPLETED' ? odoBefore.plus(new Decimal(25).plus(index % 75)).toFixed(1) : null,
      passenger_count: (index % 8) + 1,
      status,
      created_by_user_id: actorId,
      dispatched_at: status === 'DISPATCHED' || status === 'COMPLETED' ? dispatchedAt : null,
      completed_at: status === 'COMPLETED' ? completedAt : null,
      cancelled_at: status === 'CANCELLED' ? cancelledAt : null,
      cancelled_by_user_id: status === 'CANCELLED' ? actorId : null,
      cancellation_reason:
        status === 'CANCELLED' ? 'Synthetic cancellation for demonstration history' : null,
      created_at: new Date(Math.min(now.getTime(), startAt.getTime() - 86_400_000)),
      updated_at:
        status === 'COMPLETED'
          ? completedAt
          : status === 'CANCELLED'
            ? cancelledAt
            : status === 'DISPATCHED'
              ? dispatchedAt
              : now,
    };
  });
  await transaction.insertInto('vehicle_dispatches').values(rows).execute();
}

function allocationKey(officeId: string, year: number, quarter: number): string {
  return `${officeId}:${year}:${quarter}`;
}

function quarterFor(date: string): number {
  return Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1;
}

function shiftCivilDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function instantForCivilDate(date: string, hoursAfterMidnightManila: number): Date {
  return new Date(
    new Date(`${date}T00:00:00.000Z`).getTime() - 28_800_000 + hoursAfterMidnightManila * 3_600_000,
  );
}

function newPublicId(publicIds: UuidV7Generator): Buffer {
  return publicIdToBinary(PublicId.from(publicIds.generate().toString()));
}

async function main(): Promise<void> {
  assertDemoSeedEnvironment(process.env.NODE_ENV);
  const input = parseDemoSeedArguments(process.argv.slice(2));
  const database = getMigrationDatabase();
  try {
    const result = await seedDemoData(database, { ...input, now: new Date() });
    console.info(`Added ${result.count} synthetic operational records.`);
    console.info(`Fuel issuances: ${result.fuelIssuances}`);
    console.info(`Vehicle dispatches: ${result.dispatches}`);
    console.info(
      `Supporting data: ${result.offices} offices, ${result.drivers} drivers, ${result.vehicles} vehicles, ${result.budgetAllocations} budget allocations.`,
    );
    console.info(`Reference date: ${result.referenceDate} (Asia/Manila)`);
  } finally {
    await database.destroy();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
