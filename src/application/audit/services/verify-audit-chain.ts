import type {
  AuditSinkRecordDto,
  AuditSinkVerificationCursorDto,
  AuditVerificationChainRecordDto,
  AuditVerificationMismatchType,
  CompletedAuditVerificationRunDto,
} from '@/application/audit/dto/audit-event-dtos';
import type { AuditHasher } from '@/application/audit/ports/audit-hasher';
import type { AuditVerificationRepository } from '@/application/audit/ports/audit-verification-repository';
import type { Clock } from '@/application/auth/ports/clock';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

export class VerifyAuditChain {
  constructor(
    private readonly dependencies: {
      readonly repository: AuditVerificationRepository;
      readonly hasher: AuditHasher;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
      readonly pageSize: number;
    },
  ) {}

  async execute(): Promise<CompletedAuditVerificationRunDto> {
    const startedAt = this.dependencies.clock.now().toISOString();
    const highWater = await this.dependencies.repository.readPrimaryHighWaterMark();
    const runPublicId = this.dependencies.publicIds.generate().toString();
    const through = BigInt(highWater.sequence);
    let verifiedCount = BigInt(0);
    let expectedSequence = BigInt(1);
    let previousSourcePosition = BigInt(0);
    let expectedPreviousHash: Uint8Array = new Uint8Array(32);

    let primaryPage: readonly AuditVerificationChainRecordDto[] = [];
    let primaryIndex = 0;
    let primaryAfter = '0';
    let primaryDone = false;
    const peekPrimary = async (): Promise<AuditVerificationChainRecordDto | null> => {
      if (primaryIndex < primaryPage.length) return primaryPage[primaryIndex]!;
      if (primaryDone) return null;
      primaryPage = await this.dependencies.repository.readPrimaryPage(
        primaryAfter,
        highWater.sequence,
        this.dependencies.pageSize,
      );
      primaryIndex = 0;
      if (primaryPage.length === 0) {
        primaryDone = true;
        return null;
      }
      primaryAfter = primaryPage.at(-1)!.sequence;
      return primaryPage[0]!;
    };
    const takePrimary = async (): Promise<AuditVerificationChainRecordDto | null> => {
      const value = await peekPrimary();
      if (value !== null) primaryIndex += 1;
      return value;
    };

    let sinkPage: readonly AuditSinkRecordDto[] = [];
    let sinkIndex = 0;
    let sinkAfter: AuditSinkVerificationCursorDto | null = null;
    let sinkDone = false;
    const peekSink = async (): Promise<AuditSinkRecordDto | null> => {
      if (sinkIndex < sinkPage.length) return sinkPage[sinkIndex]!;
      if (sinkDone) return null;
      sinkPage = await this.dependencies.repository.readSinkPage(
        sinkAfter,
        highWater.sequence,
        this.dependencies.pageSize,
      );
      sinkIndex = 0;
      if (sinkPage.length === 0) {
        sinkDone = true;
        return null;
      }
      const last = sinkPage.at(-1)!;
      sinkAfter = {
        sequence: last.sequence,
        deliveryFingerprint: last.deliveryFingerprint,
      };
      return sinkPage[0]!;
    };
    const takeSink = async (): Promise<AuditSinkRecordDto | null> => {
      const value = await peekSink();
      if (value !== null) sinkIndex += 1;
      return value;
    };

    const fail = async (
      sequence: string,
      mismatch: AuditVerificationMismatchType,
    ): Promise<CompletedAuditVerificationRunDto> => {
      const run: CompletedAuditVerificationRunDto = {
        publicId: runPublicId,
        status: 'FAIL',
        highWaterSequence: highWater.sequence,
        verifiedCount: verifiedCount.toString(),
        firstMismatchSequence: sequence,
        firstMismatchType: mismatch,
        summary: `Audit verification failed at sequence ${sequence}: ${mismatch}.`,
        startedAt,
        completedAt: this.dependencies.clock.now().toISOString(),
      };
      await this.dependencies.repository.appendCompletedRun(run, highWater.recordHash);
      return run;
    };

    while (expectedSequence <= through) {
      const expected = expectedSequence.toString();
      const primary = await peekPrimary();
      const sink = await peekSink();
      if (primary === null || BigInt(primary.sequence) > expectedSequence) {
        return sink !== null && sink.sequence === expected
          ? fail(expected, 'EXTRA_SINK')
          : fail(expected, 'MISSING_PRIMARY');
      }
      if (BigInt(primary.sequence) < expectedSequence) {
        return fail(expected, 'REORDERED_SEQUENCE');
      }
      if (sink === null || BigInt(sink.sequence) > expectedSequence) {
        return fail(expected, 'MISSING_SINK');
      }
      if (BigInt(sink.sequence) < expectedSequence) {
        return fail(expected, 'REORDERED_SEQUENCE');
      }

      await takePrimary();
      await takeSink();
      if ((await peekSink())?.sequence === expected) {
        return fail(expected, 'DUPLICATE_SINK');
      }
      const sourcePosition = BigInt(primary.sourcePosition);
      if (sourcePosition <= previousSourcePosition) {
        return fail(expected, 'REORDERED_SEQUENCE');
      }
      if (!sameBytes(primary.previousHash, expectedPreviousHash)) {
        return fail(expected, 'PREVIOUS_HASH_MISMATCH');
      }
      const canonicalPayload = new TextEncoder().encode(primary.canonicalPayload);
      const expectedRecordHash = this.dependencies.hasher.hashRecord({
        formatVersion: 1,
        sequence: expected,
        previousHash: expectedPreviousHash,
        canonicalPayload,
      });
      if (!sameBytes(primary.recordHash, expectedRecordHash)) {
        return fail(expected, 'RECORD_HASH_MISMATCH');
      }
      if (sink.eventPublicId !== primary.eventPublicId) {
        return fail(expected, 'EVENT_ID_MISMATCH');
      }
      if (sink.canonicalPayload !== primary.canonicalPayload) {
        return fail(expected, 'CHANGED_PAYLOAD');
      }
      if (!sameBytes(sink.previousHash, primary.previousHash)) {
        return fail(expected, 'PREVIOUS_HASH_MISMATCH');
      }
      if (!sameBytes(sink.recordHash, primary.recordHash)) {
        return fail(expected, 'RECORD_HASH_MISMATCH');
      }
      const expectedFingerprint = this.dependencies.hasher.hashDelivery({
        sequence: expected,
        eventPublicId: primary.eventPublicId,
        canonicalPayload,
        previousHash: primary.previousHash,
        recordHash: primary.recordHash,
      });
      if (!sameBytes(sink.deliveryFingerprint, expectedFingerprint)) {
        return fail(expected, 'RECORD_HASH_MISMATCH');
      }

      expectedPreviousHash = primary.recordHash;
      previousSourcePosition = sourcePosition;
      verifiedCount += BigInt(1);
      expectedSequence += BigInt(1);
    }

    if ((await peekPrimary()) !== null) {
      return fail(highWater.sequence, 'REORDERED_SEQUENCE');
    }
    if ((await peekSink()) !== null) {
      return fail(highWater.sequence, 'EXTRA_SINK');
    }
    if (!sameBytes(expectedPreviousHash, highWater.recordHash)) {
      return fail(highWater.sequence, 'CAPTURED_HEAD_MISMATCH');
    }

    const run: CompletedAuditVerificationRunDto = {
      publicId: runPublicId,
      status: 'PASS',
      highWaterSequence: highWater.sequence,
      verifiedCount: verifiedCount.toString(),
      firstMismatchSequence: null,
      firstMismatchType: null,
      summary: 'Primary and sink audit records match through the captured high-water mark.',
      startedAt,
      completedAt: this.dependencies.clock.now().toISOString(),
    };
    await this.dependencies.repository.appendCompletedRun(run, highWater.recordHash);
    return run;
  }
}
