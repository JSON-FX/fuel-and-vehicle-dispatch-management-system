import type { Kysely } from 'kysely';

import { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import { AuditSinkDeliveryWorker } from '@/application/audit/services/audit-sink-delivery-worker';
import { VerifyAuditChain } from '@/application/audit/services/verify-audit-chain';
import { GetAuditEvent } from '@/application/audit/use-cases/get-audit-event';
import { GetLatestAuditVerification } from '@/application/audit/use-cases/get-latest-audit-verification';
import { SearchAuditEvents } from '@/application/audit/use-cases/search-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';
import {
  parseAuditVerifierEnvironment,
  parseAuditWorkerEnvironment,
} from '@/infrastructure/config/environment';
import { createAuditDatabaseClients } from '@/infrastructure/database/audit/client';
import { KyselyAuditChainRepository } from '@/infrastructure/database/audit/kysely-audit-chain-repository';
import { KyselyAuditQueryRepository } from '@/infrastructure/database/audit/kysely-audit-query-repository';
import { KyselyAuditReadTransaction } from '@/infrastructure/database/audit/kysely-audit-read-transaction';
import { KyselyAuditSink } from '@/infrastructure/database/audit/kysely-audit-sink';
import { KyselyAuditVerificationRepository } from '@/infrastructure/database/audit/kysely-audit-verification-repository';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

export interface AuditWebComposition {
  readonly searchAuditEvents: SearchAuditEvents;
  readonly getAuditEvent: GetAuditEvent;
  readonly getLatestAuditVerification: GetLatestAuditVerification;
}

export interface AuditWorkerComposition {
  readonly chainWorker: AuditChainWorker;
  readonly sinkDeliveryWorker: AuditSinkDeliveryWorker;
  readonly pollIntervalMs: number;
  readonly close: () => Promise<void>;
}

export interface AuditVerifierComposition {
  readonly verifyAuditChain: VerifyAuditChain;
  readonly close: () => Promise<void>;
}

const systemClock: Clock = Object.freeze({ now: () => new Date() });

export function createAuditWebComposition(
  database: Kysely<Database>,
  options: {
    readonly primarySchema: string;
    readonly maximumCanonicalPayloadBytes: number;
  },
  dependencies: {
    readonly publicIds: PublicIdGenerator;
    readonly clock: Clock;
  } = { publicIds: new UuidV7Generator(), clock: systemClock },
): AuditWebComposition {
  const transaction = new KyselyAuditReadTransaction(database, options);
  const queries = new KyselyAuditQueryRepository(database, options);
  const common = { transaction, ...dependencies } as const;
  return Object.freeze({
    searchAuditEvents: new SearchAuditEvents(common),
    getAuditEvent: new GetAuditEvent(common),
    getLatestAuditVerification: new GetLatestAuditVerification(queries),
  });
}

export function createAuditWorkerComposition(
  environment: Record<string, string | undefined> = process.env,
): AuditWorkerComposition {
  const configuration = parseAuditWorkerEnvironment(environment);
  const clients = createAuditDatabaseClients(configuration);
  const repository = new KyselyAuditChainRepository(clients.primary, {
    primarySchema: configuration.policy.primarySchema,
  });
  const hasher = new NodeSha256AuditHasher();
  return Object.freeze({
    chainWorker: new AuditChainWorker({
      repository,
      canonicalizer: new Rfc8785AuditCanonicalizer(),
      hasher,
      clock: systemClock,
      policy: {
        batchSize: configuration.policy.chainBatchSize,
        maximumCanonicalPayloadBytes: configuration.policy.maxCanonicalPayloadBytes,
      },
    }),
    sinkDeliveryWorker: new AuditSinkDeliveryWorker({
      repository,
      sink: new KyselyAuditSink(clients.sink, {
        sinkSchema: configuration.policy.sinkSchema,
      }),
      hasher,
      clock: systemClock,
      random: Math.random,
      policy: {
        batchSize: configuration.policy.sinkBatchSize,
        retryBaseMs: configuration.policy.retryBaseMs,
        retryMaxMs: configuration.policy.retryMaxMs,
      },
    }),
    pollIntervalMs: configuration.policy.pollIntervalMs,
    close: clients.close,
  });
}

export function createAuditVerifierComposition(
  environment: Record<string, string | undefined> = process.env,
): AuditVerifierComposition {
  const configuration = parseAuditVerifierEnvironment(environment);
  const clients = createAuditDatabaseClients(configuration);
  return Object.freeze({
    verifyAuditChain: new VerifyAuditChain({
      repository: new KyselyAuditVerificationRepository(clients.primary, clients.sink, {
        primarySchema: configuration.policy.primarySchema,
        sinkSchema: configuration.policy.sinkSchema,
      }),
      hasher: new NodeSha256AuditHasher(),
      publicIds: new UuidV7Generator(),
      clock: systemClock,
      pageSize: configuration.policy.verificationPageSize,
    }),
    close: clients.close,
  });
}
