import {
  toDispatchDetailDto,
  type CancelDispatchCommand,
  type DispatchDetailDto,
  type DispatchRequestContext,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import {
  buildDispatchAuditEvent,
  dispatchAuditSnapshot,
} from '@/application/dispatch/services/dispatch-audit-events';
import {
  asDispatchBusinessRule,
  normalizeCancellationReason,
} from '@/application/dispatch/services/dispatch-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class CancelDispatch {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly publicId: string;
    readonly command: CancelDispatchCommand;
  }): Promise<DispatchDetailDto> {
    this.dependencies.permissions.assertCanCancel(input.context.principal);
    const reason = normalizeCancellationReason(input.command.reason);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const dispatch = await repositories.dispatches.findByPublicIdForUpdate(input.publicId);
      if (dispatch === null) throw new NotFoundError();
      this.dependencies.permissions.assertCanCancel(input.context.principal, dispatch);
      const before = dispatchAuditSnapshot(dispatch);
      asDispatchBusinessRule(() =>
        dispatch.cancel({
          at,
          actorPublicId: PublicId.from(input.context.principal.userPublicId),
          reason,
        }),
      );
      await repositories.dispatches.updateLifecycle(dispatch);
      await repositories.auditEvents.append(
        buildDispatchAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'cancelled',
          entityPublicId: dispatch.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'OPERATOR_CANCEL',
          before,
          after: dispatchAuditSnapshot(dispatch),
          metadata: { reason },
        }),
      );
      const record = await repositories.dispatches.findByPublicId(dispatch.publicId.toString());
      if (record === null) throw new NotFoundError();
      return toDispatchDetailDto(record);
    });
  }
}
