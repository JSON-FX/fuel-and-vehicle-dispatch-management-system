import type { Kysely } from 'kysely';

import type { DispatchScheduleSettingsDto } from '@/application/dispatch/dto/dispatch-dtos';
import type {
  DispatchScheduleSettingsRepository,
  PersistDispatchScheduleSettingsCommand,
} from '@/application/dispatch/ports/dispatch-schedule-settings-repository';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Database } from '@/infrastructure/database/types';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export class KyselyDispatchScheduleSettingsRepository implements DispatchScheduleSettingsRepository {
  constructor(private readonly database: Kysely<Database>) {}

  get(): Promise<DispatchScheduleSettingsDto> {
    return this.read(false);
  }

  getForShare(): Promise<DispatchScheduleSettingsDto> {
    return this.read(true);
  }

  async update(
    command: PersistDispatchScheduleSettingsCommand,
  ): Promise<DispatchScheduleSettingsDto> {
    const actor = await this.database
      .selectFrom('users')
      .select('id')
      .where('public_id', '=', publicIdToBinary(PublicId.from(command.updatedByActorPublicId)))
      .executeTakeFirstOrThrow();
    await this.database
      .updateTable('dispatch_schedule_settings')
      .set({
        policy: command.policy,
        updated_by_user_id: actor.id,
        updated_at: command.updatedAt,
      })
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    return this.get();
  }

  private async read(lock: boolean): Promise<DispatchScheduleSettingsDto> {
    const query = this.database
      .selectFrom('dispatch_schedule_settings as settings')
      .leftJoin('users as actor', 'actor.id', 'settings.updated_by_user_id')
      .select(['settings.policy', 'settings.updated_at', 'actor.public_id as updated_by_public_id'])
      .where('settings.id', '=', 1);
    const row = await (lock ? query.forShare() : query).executeTakeFirstOrThrow();
    return {
      policy: row.policy,
      updatedByActorPublicId:
        row.updated_by_public_id === null
          ? null
          : binaryToPublicId(row.updated_by_public_id).toString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
