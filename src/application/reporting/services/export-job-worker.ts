import type { Clock } from '@/application/auth/ports/clock';
import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type {
  ExportFailureCode,
  ExportJobRecord,
} from '@/application/reporting/dto/export-job-dtos';
import type { ExportJobRepository } from '@/application/reporting/ports/export-job-repository';
import type { PrivateExportStorage } from '@/application/reporting/ports/private-export-storage';
import type { ReportExporter } from '@/application/reporting/ports/report-exporter';
import type { ReportQueryRepository } from '@/application/reporting/ports/report-query-repository';
import type { ReportRequesterRepository } from '@/application/reporting/ports/report-requester-repository';
import type { ReportingTransaction } from '@/application/reporting/ports/reporting-transaction';
import { buildReportExportAuditEvent } from '@/application/reporting/services/report-audit-events';
import type { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

interface ExportExecutionDependencies {
  readonly exportJobs: ExportJobRepository;
  readonly transaction: ReportingTransaction;
  readonly queries: ReportQueryRepository;
  readonly requesters: ReportRequesterRepository;
  readonly permissions: ReportPermissionPolicy;
  readonly exporter: ReportExporter;
  readonly storage: PrivateExportStorage;
  readonly publicIds: PublicIdGenerator;
  readonly clock: Clock;
  readonly retentionMs?: number;
  readonly timeoutMs?: number;
  readonly leaseRenewalMs?: number;
  readonly leaseDurationMs?: number;
}

export class ExportJobExecutor {
  constructor(private readonly dependencies: ExportExecutionDependencies) {}

  async execute(job: ExportJobRecord, workerId: string | null): Promise<ExportJobRecord> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.dependencies.timeoutMs ?? 15 * 60_000,
    );
    timeout.unref();
    let pendingKey: string | null = null;
    let finalizedKey: string | null = null;
    let renewal: ReturnType<typeof setInterval> | null = null;

    try {
      const requester = await this.dependencies.requesters.findByPublicId(job.requesterPublicId);
      if (requester === null || !requester.isActive || requester.deletedAt !== null) {
        throw new AuthorizationError();
      }
      this.dependencies.permissions.assertCanExport(requester.principal, job.reportType);
      if (workerId !== null && job.attempts >= job.maxAttempts) {
        throw attemptsExhausted();
      }

      if (workerId !== null) {
        const renewalMs = this.dependencies.leaseRenewalMs ?? 60_000;
        const leaseDurationMs = this.dependencies.leaseDurationMs ?? 16 * 60_000;
        renewal = setInterval(() => {
          const leaseExpiresAt = new Date(
            this.dependencies.clock.now().valueOf() + leaseDurationMs,
          );
          void this.dependencies.exportJobs
            .renewLease(job.id, workerId, leaseExpiresAt)
            .then((renewed) => {
              if (!renewed) controller.abort();
            })
            .catch(() => controller.abort());
        }, renewalMs);
        renewal.unref();
      }

      const pending = await this.dependencies.storage.createPending();
      pendingKey = pending.storageKey;
      const generatedAt = this.dependencies.clock.now();
      const result = await this.dependencies.exporter.export({
        reportType: job.reportType,
        filters: { ...job.filters, cursor: null, pageSize: 200 },
        period: {
          periodType: job.filters.periodType,
          startDate: job.filters.startDate,
          endDate: job.filters.endDate,
          referenceDate: job.filters.referenceDate,
          timeZone: 'Asia/Manila',
        },
        generatedAt,
        dataAsOf: generatedAt,
        rows: this.dependencies.queries.streamRows(
          { ...job.filters, cursor: null, pageSize: 200 },
          controller.signal,
        ),
        sink: pending,
        signal: controller.signal,
      });
      const finalized = await this.dependencies.storage.finalize(pending.storageKey);
      pendingKey = null;
      finalizedKey = finalized.storageKey;
      const finishedAt = this.dependencies.clock.now();
      const completed = await this.dependencies.transaction.execute(async (repositories) => {
        await repositories.exportJobs.complete(job.id, workerId, {
          actualRows: result.rowCount,
          storageKey: finalized.storageKey,
          filename: result.filename,
          mimeType: result.mimeType,
          byteLength: finalized.byteLength,
          sha256: finalized.sha256,
          finishedAt,
          fileExpiresAt: new Date(
            finishedAt.valueOf() + (this.dependencies.retentionMs ?? 7 * 86_400_000),
          ),
        });
        const completedJob = await repositories.exportJobs.findOwn(
          job.publicId,
          job.requesterUserId,
        );
        if (completedJob === null) throw new Error('Completed export job is unavailable.');
        await repositories.auditEvents.append(
          buildReportExportAuditEvent({
            publicId: this.dependencies.publicIds.generate().toString(),
            action: 'completed',
            job: completedJob,
            context: workerContext(requester.principal, job.publicId),
            occurredAt: finishedAt,
          }),
        );
        return completedJob;
      });
      finalizedKey = null;
      return completed;
    } catch (error) {
      if (pendingKey !== null)
        await this.dependencies.storage.abort(pendingKey).catch(() => undefined);
      if (finalizedKey !== null)
        await this.dependencies.storage.delete(finalizedKey).catch(() => undefined);
      return this.settleFailure(job, workerId, error);
    } finally {
      clearTimeout(timeout);
      if (renewal !== null) clearInterval(renewal);
    }
  }

  private async settleFailure(
    job: ExportJobRecord,
    workerId: string | null,
    error: unknown,
  ): Promise<ExportJobRecord> {
    const failure = classifyFailure(error);
    const at = this.dependencies.clock.now();
    if (workerId !== null && failure.retryable && job.attempts < job.maxAttempts) {
      const retryDelay = Math.min(60_000, 1_000 * 2 ** Math.max(0, job.attempts - 1));
      await this.dependencies.exportJobs.retry(
        job.id,
        workerId,
        new Date(at.valueOf() + retryDelay),
        at,
      );
      return this.requireJob(job);
    }

    const requester = await this.dependencies.requesters.findByPublicId(job.requesterPublicId);
    const context = workerContext(requester?.principal ?? fallbackPrincipal(job), job.publicId);
    return this.dependencies.transaction.execute(async (repositories) => {
      await repositories.exportJobs.fail(job.id, workerId, {
        failureCode: failure.code,
        failureMessage: failure.message,
        failedAt: at,
      });
      const failed = await repositories.exportJobs.findOwn(job.publicId, job.requesterUserId);
      if (failed === null) throw new Error('Failed export job is unavailable.');
      await repositories.auditEvents.append(
        buildReportExportAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'failed',
          job: failed,
          context,
          occurredAt: at,
          failureCode: failure.code,
        }),
      );
      return failed;
    });
  }

  private async requireJob(job: ExportJobRecord): Promise<ExportJobRecord> {
    const current = await this.dependencies.exportJobs.findOwn(job.publicId, job.requesterUserId);
    if (current === null) throw new Error('Export job is unavailable after transition.');
    return current;
  }
}

export class ExportJobWorker {
  constructor(
    private readonly dependencies: {
      readonly exportJobs: ExportJobRepository;
      readonly executor: ExportJobExecutor;
      readonly storage: PrivateExportStorage;
      readonly clock: Clock;
      readonly leaseDurationMs?: number;
      readonly staleTemporaryMs?: number;
    },
  ) {}

  async runOnce(workerId: string): Promise<boolean> {
    const at = this.dependencies.clock.now();
    const job = await this.dependencies.exportJobs.claimNext(
      workerId,
      at,
      new Date(at.valueOf() + (this.dependencies.leaseDurationMs ?? 16 * 60_000)),
    );
    if (job === null) return false;
    await this.dependencies.executor.execute(job, workerId);
    return true;
  }

  async runCleanup(): Promise<{
    readonly expiredFiles: number;
    readonly expiredTokens: number;
    readonly temporaryFiles: number;
  }> {
    const at = this.dependencies.clock.now();
    const jobs = await this.dependencies.exportJobs.expireCompleted(at, 100);
    let expiredFiles = 0;
    for (const job of jobs) {
      if (job.storageKey === null) continue;
      await this.dependencies.storage.delete(job.storageKey);
      await this.dependencies.exportJobs.markExpired(job.id, at);
      expiredFiles += 1;
    }
    const expiredTokens = await this.dependencies.exportJobs.deleteExpiredDownloadTokens(at, 500);
    const temporaryFiles = await this.dependencies.storage.cleanupTemporaryFiles(
      new Date(at.valueOf() - (this.dependencies.staleTemporaryMs ?? 60 * 60_000)),
      100,
    );
    return { expiredFiles, expiredTokens, temporaryFiles };
  }
}

function classifyFailure(error: unknown): {
  readonly code: ExportFailureCode;
  readonly message: string;
  readonly retryable: boolean;
} {
  if (error instanceof AuthorizationError) {
    return {
      code: 'AUTHORIZATION_REVOKED',
      message: 'The requester no longer has permission to export this report.',
      retryable: false,
    };
  }
  const code = (error as { code?: unknown }).code;
  if (code === 'ROW_LIMIT_EXCEEDED' || code === 'FILE_LIMIT_EXCEEDED') {
    return { code, message: 'The export exceeded a configured safety limit.', retryable: false };
  }
  if (code === 'GENERATION_TIMEOUT' || (error as { name?: unknown }).name === 'AbortError') {
    return {
      code: 'GENERATION_TIMEOUT',
      message: 'The export exceeded the generation time limit.',
      retryable: true,
    };
  }
  if (code === 'ATTEMPTS_EXHAUSTED') {
    return {
      code: 'GENERATION_FAILED',
      message: 'The export could not be generated after the allowed attempts.',
      retryable: false,
    };
  }
  if (typeof code === 'string' && (code.startsWith('ER_') || code.startsWith('ECONN'))) {
    return {
      code: 'DATABASE_UNAVAILABLE',
      message: 'The reporting database was temporarily unavailable.',
      retryable: true,
    };
  }
  if (String((error as { name?: unknown }).name ?? '').startsWith('PrivateExport')) {
    return {
      code: 'STORAGE_UNAVAILABLE',
      message: 'Private export storage was temporarily unavailable.',
      retryable: true,
    };
  }
  return {
    code: 'GENERATION_FAILED',
    message: 'The export could not be generated.',
    retryable: true,
  };
}

function attemptsExhausted(): Error & { readonly code: 'ATTEMPTS_EXHAUSTED' } {
  return Object.assign(new Error('Export attempts exhausted.'), {
    code: 'ATTEMPTS_EXHAUSTED' as const,
  });
}

function workerContext(principal: CurrentPrincipal, jobPublicId: string) {
  return {
    principal,
    requestId: `report-export:${jobPublicId}`,
    ipAddress: null,
    userAgent: 'FVDMS reporting worker',
  };
}

function fallbackPrincipal(job: ExportJobRecord): CurrentPrincipal {
  return {
    userPublicId: job.requesterPublicId,
    username: 'unavailable-requester',
    fullName: 'Unavailable requester',
    roles: [] as readonly string[],
    permissions: [] as readonly string[],
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  };
}
