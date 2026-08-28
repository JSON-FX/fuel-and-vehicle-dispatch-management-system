import { sql, type Kysely } from 'kysely';

import type { FuelSequenceRepository } from '@/application/fuel/ports/fuel-sequence-repository';
import type { Database } from '@/infrastructure/database/types';

export class KyselyFuelSequenceRepository implements FuelSequenceRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async next(input: {
    readonly year: number;
    readonly month: number;
    readonly at: Date;
  }): Promise<number> {
    await sql`
      insert into fuel_sequence_monthly (
        sequence_year,
        sequence_month,
        last_number,
        created_at,
        updated_at
      ) values (${input.year}, ${input.month}, 0, ${input.at}, ${input.at})
      on duplicate key update sequence_year = values(sequence_year)
    `.execute(this.database);

    const row = await this.database
      .selectFrom('fuel_sequence_monthly')
      .select(['id', 'last_number'])
      .where('sequence_year', '=', input.year)
      .where('sequence_month', '=', input.month)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const nextNumber = row.last_number + 1;
    await this.database
      .updateTable('fuel_sequence_monthly')
      .set({ last_number: nextNumber, updated_at: input.at })
      .where('id', '=', row.id)
      .executeTakeFirst();
    return nextNumber;
  }
}
