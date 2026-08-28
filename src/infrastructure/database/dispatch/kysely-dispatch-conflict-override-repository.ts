import type { Kysely } from 'kysely';

import type {
  DispatchConflictEvidenceQueryDto,
  DispatchConflictOverrideHistoryDto,
  DispatchConflictOverrideWriteDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchConflictOverrideRepository } from '@/application/dispatch/ports/dispatch-conflict-override-repository';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export class KyselyDispatchConflictOverrideRepository implements DispatchConflictOverrideRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async appendMany(overrides: readonly DispatchConflictOverrideWriteDto[]): Promise<void> {
    if (overrides.length === 0) return;
    const rows = await Promise.all(
      overrides.map(async (override) => ({
        public_id: publicIdToBinary(PublicId.from(override.publicId)),
        dispatch_id: await this.referenceId('vehicle_dispatches', override.dispatchPublicId),
        conflicting_dispatch_id: await this.referenceId(
          'vehicle_dispatches',
          override.conflictingDispatchPublicId,
        ),
        conflict_type: override.conflictType,
        policy: override.policy,
        acknowledged_by_user_id: await this.referenceId(
          'users',
          override.acknowledgedByActorPublicId,
        ),
        acknowledgement_reason: override.reason,
        acknowledged_at: new Date(override.acknowledgedAt),
        created_at: new Date(override.acknowledgedAt),
      })),
    );
    await this.database.insertInto('vehicle_dispatch_conflict_overrides').values(rows).execute();
  }

  async hasMatchingEvidence(query: DispatchConflictEvidenceQueryDto): Promise<boolean> {
    const row = await this.database
      .selectFrom('vehicle_dispatch_conflict_overrides as override')
      .innerJoin('vehicle_dispatches as dispatch', 'dispatch.id', 'override.dispatch_id')
      .innerJoin(
        'vehicle_dispatches as conflicting',
        'conflicting.id',
        'override.conflicting_dispatch_id',
      )
      .select('override.id')
      .where('dispatch.public_id', '=', publicIdToBinary(PublicId.from(query.dispatchPublicId)))
      .where(
        'conflicting.public_id',
        '=',
        publicIdToBinary(PublicId.from(query.conflictingDispatchPublicId)),
      )
      .where('override.conflict_type', '=', query.conflictType)
      .limit(1)
      .executeTakeFirst();
    return row !== undefined;
  }

  async listForDispatch(
    dispatchPublicId: string,
  ): Promise<readonly DispatchConflictOverrideHistoryDto[]> {
    const rows = await this.database
      .selectFrom('vehicle_dispatch_conflict_overrides as override')
      .innerJoin('vehicle_dispatches as dispatch', 'dispatch.id', 'override.dispatch_id')
      .innerJoin(
        'vehicle_dispatches as conflicting',
        'conflicting.id',
        'override.conflicting_dispatch_id',
      )
      .innerJoin('drivers as driver', 'driver.id', 'conflicting.driver_id')
      .innerJoin('vehicles as vehicle', 'vehicle.id', 'conflicting.vehicle_id')
      .innerJoin('users as actor', 'actor.id', 'override.acknowledged_by_user_id')
      .select([
        'override.public_id',
        'override.conflict_type',
        'override.policy',
        'override.acknowledgement_reason',
        'override.acknowledged_at',
        'conflicting.public_id as conflicting_public_id',
        'conflicting.travel_date',
        'conflicting.destination',
        'driver.full_name as driver_name',
        'vehicle.plate_no as vehicle_plate_number',
        'actor.public_id as actor_public_id',
      ])
      .where('dispatch.public_id', '=', publicIdToBinary(PublicId.from(dispatchPublicId)))
      .orderBy('override.acknowledged_at', 'desc')
      .orderBy('override.public_id', 'desc')
      .execute();

    return rows.map((row) => ({
      publicId: binaryToPublicId(row.public_id).toString(),
      conflictingDispatchPublicId: binaryToPublicId(row.conflicting_public_id).toString(),
      conflictingDispatchLabel: `${row.travel_date} · ${row.destination} · ${row.driver_name} / ${row.vehicle_plate_number}`,
      conflictType: row.conflict_type,
      policy: row.policy,
      reason: row.acknowledgement_reason,
      acknowledgedByActorPublicId: binaryToPublicId(row.actor_public_id).toString(),
      acknowledgedAt: row.acknowledged_at.toISOString(),
    }));
  }

  private async referenceId(
    table: 'vehicle_dispatches' | 'users',
    publicId: string,
  ): Promise<string> {
    const row = await this.database
      .selectFrom(table)
      .select('id')
      .where('public_id', '=', publicIdToBinary(PublicId.from(publicId)))
      .executeTakeFirstOrThrow();
    return row.id;
  }
}
