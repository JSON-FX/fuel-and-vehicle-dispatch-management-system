import { describe, expect, it } from 'vitest';

import type {
  AuditSinkRecordDto,
  AuditSinkVerificationCursorDto,
  AuditVerificationChainRecordDto,
  AuditVerificationHighWaterMarkDto,
  CompletedAuditVerificationRunDto,
} from '@/application/audit/dto/audit-event-dtos';
import type { AuditVerificationRepository } from '@/application/audit/ports/audit-verification-repository';
import { VerifyAuditChain } from '@/application/audit/services/verify-audit-chain';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';

const hasher = new NodeSha256AuditHasher();
const verificationPublicId = '01900000-0000-7000-8000-000000000999';

function records(count = 2): {
  primary: AuditVerificationChainRecordDto[];
  sink: AuditSinkRecordDto[];
  highWater: AuditVerificationHighWaterMarkDto;
} {
  const primary: AuditVerificationChainRecordDto[] = [];
  let previousHash: Uint8Array = new Uint8Array(32);
  for (let index = 1; index <= count; index += 1) {
    const sequence = index.toString();
    const canonicalPayload = JSON.stringify({ index });
    const eventPublicId = `01900000-0000-7000-8000-${sequence.padStart(12, '0')}`;
    const recordHash = hasher.hashRecord({
      formatVersion: 1,
      sequence,
      previousHash,
      canonicalPayload: new TextEncoder().encode(canonicalPayload),
    });
    primary.push({
      sequence,
      sourcePosition: sequence,
      eventPublicId,
      canonicalPayload,
      previousHash,
      recordHash,
    });
    previousHash = recordHash;
  }
  const sink = primary.map((record) => ({
    ...record,
    deliveryFingerprint: hasher.hashDelivery({
      sequence: record.sequence,
      eventPublicId: record.eventPublicId,
      canonicalPayload: new TextEncoder().encode(record.canonicalPayload),
      previousHash: record.previousHash,
      recordHash: record.recordHash,
    }),
    deliveredAt: '2026-08-28T07:00:00.000Z',
  }));
  return {
    primary,
    sink,
    highWater: { sequence: count.toString(), recordHash: previousHash },
  };
}

class FakeVerificationRepository implements AuditVerificationRepository {
  readonly completed: CompletedAuditVerificationRunDto[] = [];

  constructor(
    readonly highWater: AuditVerificationHighWaterMarkDto,
    readonly primary: readonly AuditVerificationChainRecordDto[],
    readonly sink: readonly AuditSinkRecordDto[],
  ) {}

  async readPrimaryHighWaterMark(): Promise<AuditVerificationHighWaterMarkDto> {
    return this.highWater;
  }

  async readPrimaryPage(
    afterSequence: string,
    throughSequence: string,
    limit: number,
  ): Promise<readonly AuditVerificationChainRecordDto[]> {
    return this.primary
      .filter(
        (record) =>
          BigInt(record.sequence) > BigInt(afterSequence) &&
          BigInt(record.sequence) <= BigInt(throughSequence),
      )
      .slice(0, limit);
  }

  async readSinkPage(
    after: AuditSinkVerificationCursorDto | null,
    throughSequence: string,
    limit: number,
  ): Promise<readonly AuditSinkRecordDto[]> {
    return this.sink
      .filter((record) => {
        if (BigInt(record.sequence) > BigInt(throughSequence)) return false;
        if (after === null || BigInt(record.sequence) > BigInt(after.sequence)) return true;
        return (
          record.sequence === after.sequence &&
          Buffer.compare(
            Buffer.from(record.deliveryFingerprint),
            Buffer.from(after.deliveryFingerprint),
          ) > 0
        );
      })
      .slice(0, limit);
  }

  async appendCompletedRun(run: CompletedAuditVerificationRunDto): Promise<void> {
    this.completed.push(run);
  }
}

function verifier(repository: AuditVerificationRepository): VerifyAuditChain {
  return new VerifyAuditChain({
    repository,
    hasher,
    publicIds: { generate: () => PublicId.from(verificationPublicId) },
    clock: { now: () => new Date('2026-08-28T07:00:00.000Z') },
    pageSize: 1,
  });
}

describe('VerifyAuditChain', () => {
  it('passes a complete chain and sink through a captured high-water mark', async () => {
    const data = records();
    const repository = new FakeVerificationRepository(data.highWater, data.primary, data.sink);

    await expect(verifier(repository).execute()).resolves.toMatchObject({
      status: 'PASS',
      highWaterSequence: '2',
      verifiedCount: '2',
      firstMismatchType: null,
    });
    expect(repository.completed).toHaveLength(1);
  });

  it('passes an empty chain with a zero genesis head', async () => {
    const repository = new FakeVerificationRepository(
      { sequence: '0', recordHash: new Uint8Array(32) },
      [],
      [],
    );

    await expect(verifier(repository).execute()).resolves.toMatchObject({
      status: 'PASS',
      verifiedCount: '0',
    });
  });

  it.each([
    [
      'MISSING_PRIMARY',
      (data: ReturnType<typeof records>) => {
        data.primary.splice(0, 1);
        data.sink.splice(0, 1);
      },
    ],
    ['MISSING_SINK', (data: ReturnType<typeof records>) => data.sink.splice(0, 1)],
    [
      'DUPLICATE_SINK',
      (data: ReturnType<typeof records>) =>
        data.sink.splice(1, 0, {
          ...data.sink[0]!,
          deliveryFingerprint: new Uint8Array(32).fill(255),
        }),
    ],
    [
      'CHANGED_PAYLOAD',
      (data: ReturnType<typeof records>) =>
        data.sink.splice(0, 1, { ...data.sink[0]!, canonicalPayload: '{"changed":true}' }),
    ],
    [
      'PREVIOUS_HASH_MISMATCH',
      (data: ReturnType<typeof records>) =>
        data.primary.splice(1, 1, {
          ...data.primary[1]!,
          previousHash: new Uint8Array(32).fill(9),
        }),
    ],
    [
      'RECORD_HASH_MISMATCH',
      (data: ReturnType<typeof records>) =>
        data.primary.splice(0, 1, { ...data.primary[0]!, recordHash: new Uint8Array(32).fill(9) }),
    ],
    [
      'EVENT_ID_MISMATCH',
      (data: ReturnType<typeof records>) =>
        data.sink.splice(0, 1, {
          ...data.sink[0]!,
          eventPublicId: '01900000-0000-7000-8000-000000000998',
        }),
    ],
    [
      'CAPTURED_HEAD_MISMATCH',
      (data: ReturnType<typeof records>) => {
        data.highWater = { ...data.highWater, recordHash: new Uint8Array(32).fill(9) };
      },
    ],
  ])('records the first %s verification failure', async (expected, mutate) => {
    const data = records();
    mutate(data);
    const repository = new FakeVerificationRepository(data.highWater, data.primary, data.sink);

    await expect(
      new VerifyAuditChain({
        repository,
        hasher,
        publicIds: { generate: () => PublicId.from(verificationPublicId) },
        clock: { now: () => new Date('2026-08-28T07:00:00.000Z') },
        pageSize: 100,
      }).execute(),
    ).resolves.toMatchObject({
      status: 'FAIL',
      firstMismatchType: expected,
    });
    expect(repository.completed).toHaveLength(1);
  });

  it('classifies a sink row without its primary row as extra evidence', async () => {
    const data = records();
    data.primary.splice(0, 1);
    const repository = new FakeVerificationRepository(data.highWater, data.primary, data.sink);

    await expect(verifier(repository).execute()).resolves.toMatchObject({
      status: 'FAIL',
      firstMismatchType: 'EXTRA_SINK',
      firstMismatchSequence: '1',
    });
  });

  it('classifies a non-increasing primary sequence as reordered evidence', async () => {
    const data = records();
    data.primary.splice(1, 1, { ...data.primary[0]! });
    const repository = new FakeVerificationRepository(data.highWater, data.primary, data.sink);

    await expect(
      new VerifyAuditChain({
        repository,
        hasher,
        publicIds: { generate: () => PublicId.from(verificationPublicId) },
        clock: { now: () => new Date('2026-08-28T07:00:00.000Z') },
        pageSize: 100,
      }).execute(),
    ).resolves.toMatchObject({
      status: 'FAIL',
      firstMismatchType: 'REORDERED_SEQUENCE',
    });
  });

  it('propagates infrastructure failure without recording a misleading result', async () => {
    const data = records();
    const repository = new FakeVerificationRepository(data.highWater, data.primary, data.sink);
    repository.readPrimaryHighWaterMark = async () => {
      throw new Error('database unavailable');
    };

    await expect(verifier(repository).execute()).rejects.toThrow('database unavailable');
    expect(repository.completed).toEqual([]);
  });
});
