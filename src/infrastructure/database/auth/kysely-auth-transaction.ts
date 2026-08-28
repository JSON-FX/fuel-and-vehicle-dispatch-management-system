import type { Kysely } from 'kysely';

import type { AuthRepositories, AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Database } from '@/infrastructure/database/types';

import { createKyselyAuthRepositories } from './create-kysely-auth-repositories';

export class KyselyAuthTransaction implements AuthTransaction {
  constructor(private readonly database: Kysely<Database>) {}

  execute<T>(work: (repositories: AuthRepositories) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) => work(createKyselyAuthRepositories(transaction)));
  }
}
