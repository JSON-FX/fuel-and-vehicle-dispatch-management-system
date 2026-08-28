import { sql, type Kysely, type Selectable } from 'kysely';

import type { FuelBalanceDto, FuelBalanceQuery } from '@/application/fuel/dto/fuel-dtos';
import type { FuelLedgerRepository } from '@/application/fuel/ports/fuel-ledger-repository';
import { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelType, type FuelTypeValue } from '@/domain/fuel/value-objects/fuel-type';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database, FuelLedgerEntriesTable } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

type FuelLedgerRow = Selectable<FuelLedgerEntriesTable> & {
  fuel_issuance_public_id: Buffer | null;
};

interface FuelBalanceRow {
  readonly fuel_type: FuelTypeValue;
  readonly opening: string;
  readonly receipts: string;
  readonly adjustments: string;
  readonly issuances: string;
  readonly net_movement: string;
  readonly closing: string;
}

export class KyselyFuelLedgerRepository implements FuelLedgerRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async append(entry: FuelLedgerEntry): Promise<void> {
    await this.database
      .insertInto('fuel_ledger_entries')
      .values({
        public_id: publicIdToBinary(entry.publicId),
        fuel_issuance_id: await this.issuanceId(entry),
        fuel_type: entry.fuelType.toString(),
        transaction_type: entry.transactionType,
        quantity: entry.quantity.toString(),
        signed_quantity: entry.signedQuantity.toString(),
        effective_date: entry.effectiveDate.toString(),
        reference: entry.reference,
        occurred_at: entry.effectiveDate.toEffectiveInstant(),
        created_at: entry.createdAt,
      })
      .execute();
  }

  async listForIssuance(fuelIssuancePublicId: string): Promise<readonly FuelLedgerEntry[]> {
    const rows = await this.database
      .selectFrom('fuel_ledger_entries as entry')
      .innerJoin('fuel_issuances as issuance', 'issuance.id', 'entry.fuel_issuance_id')
      .selectAll('entry')
      .select('issuance.public_id as fuel_issuance_public_id')
      .where('issuance.public_id', '=', publicIdToBinary(PublicId.from(fuelIssuancePublicId)))
      .orderBy('entry.created_at', 'asc')
      .orderBy('entry.public_id', 'asc')
      .execute();
    return rows.map((row) => this.map(row as FuelLedgerRow));
  }

  async summarize(query: FuelBalanceQuery): Promise<readonly FuelBalanceDto[]> {
    let builder = this.database
      .selectFrom('fuel_ledger_entries')
      .select('fuel_type')
      .select([
        sql<string>`coalesce(sum(case when effective_date < ${query.startDate} then signed_quantity else 0 end), 0)`.as(
          'opening',
        ),
        sql<string>`coalesce(sum(case when effective_date between ${query.startDate} and ${query.endDate} and transaction_type = 'RECEIPT' then signed_quantity else 0 end), 0)`.as(
          'receipts',
        ),
        sql<string>`coalesce(sum(case when effective_date between ${query.startDate} and ${query.endDate} and transaction_type in ('OPENING', 'ADJUSTMENT') then signed_quantity else 0 end), 0)`.as(
          'adjustments',
        ),
        sql<string>`coalesce(sum(case when effective_date between ${query.startDate} and ${query.endDate} and transaction_type = 'ISSUANCE' then quantity else 0 end), 0)`.as(
          'issuances',
        ),
        sql<string>`coalesce(sum(case when effective_date between ${query.startDate} and ${query.endDate} then signed_quantity else 0 end), 0)`.as(
          'net_movement',
        ),
        sql<string>`coalesce(sum(case when effective_date <= ${query.endDate} then signed_quantity else 0 end), 0)`.as(
          'closing',
        ),
      ])
      .where('effective_date', '<=', query.endDate);
    if (query.fuelType !== null) builder = builder.where('fuel_type', '=', query.fuelType);
    const rows = (await builder.groupBy('fuel_type').execute()) as FuelBalanceRow[];
    const byType = new Map(rows.map((row) => [row.fuel_type, row]));
    const types: readonly FuelTypeValue[] =
      query.fuelType === null ? ['DIESEL', 'GASOLINE'] : [query.fuelType];
    return types.map((fuelType) => {
      const row = byType.get(fuelType);
      return {
        fuelType,
        startDate: query.startDate,
        endDate: query.endDate,
        opening: fixedQuantity(row?.opening ?? '0'),
        receipts: fixedQuantity(row?.receipts ?? '0'),
        adjustments: fixedQuantity(row?.adjustments ?? '0'),
        issuances: fixedQuantity(row?.issuances ?? '0'),
        netMovement: fixedQuantity(row?.net_movement ?? '0'),
        closing: fixedQuantity(row?.closing ?? '0'),
      };
    });
  }

  private map(row: FuelLedgerRow): FuelLedgerEntry {
    return new FuelLedgerEntry({
      publicId: binaryToPublicId(row.public_id),
      fuelIssuancePublicId:
        row.fuel_issuance_public_id === null ? null : binaryToPublicId(row.fuel_issuance_public_id),
      fuelType: FuelType.from(row.fuel_type),
      transactionType: row.transaction_type,
      quantity: FuelQuantity.from(row.quantity),
      signedQuantity: DecimalValue.from(row.signed_quantity),
      effectiveDate: EntryDate.from(row.effective_date),
      reference: row.reference,
      createdAt: row.created_at,
    });
  }

  private async issuanceId(entry: FuelLedgerEntry): Promise<string | null> {
    if (entry.fuelIssuancePublicId === null) return null;
    const row = await this.database
      .selectFrom('fuel_issuances')
      .select('id')
      .where('public_id', '=', publicIdToBinary(entry.fuelIssuancePublicId))
      .executeTakeFirstOrThrow();
    return row.id;
  }
}

function fixedQuantity(value: string): string {
  return DecimalValue.from(value).toFixed(3);
}
