import type { Kysely } from 'kysely';

import type {
  SecurityEvent,
  SecurityEventPort,
} from '@/application/auth/ports/security-event-port';
import type { Database } from '@/infrastructure/database/types';

import { publicIdBuffer, resolveUserId } from './repository-utils';

export class KyselySecurityEventStore implements SecurityEventPort {
  constructor(private readonly database: Kysely<Database>) {}

  async append(event: SecurityEvent): Promise<void> {
    await this.database
      .insertInto('auth_security_events')
      .values({
        public_id: publicIdBuffer(event.publicId),
        event_type: event.type,
        actor_user_id:
          event.actorPublicId === null
            ? null
            : await resolveUserId(this.database, event.actorPublicId),
        target_user_id:
          event.targetPublicId === null
            ? null
            : await resolveUserId(this.database, event.targetPublicId),
        request_id: event.requestId,
        reason_code: event.reasonCode,
        metadata: JSON.stringify(event.metadata),
        created_at: event.occurredAt,
      })
      .execute();
  }
}
