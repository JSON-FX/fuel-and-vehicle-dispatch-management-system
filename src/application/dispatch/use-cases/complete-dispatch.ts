import {
  toDispatchDetailDto,
  type CompleteDispatchCommand,
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
  completionOdometer,
} from '@/application/dispatch/services/dispatch-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class CompleteDispatch {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly publicId: string;
    readonly command: CompleteDispatchCommand;
  }): Promise<DispatchDetailDto> {
    this.dependencies.permissions.assertCanComplete(input.context.principal);
    const odoAfter = completionOdometer(input.command.odoAfter);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const dispatch = await repositories.dispatches.findByPublicIdForUpdate(input.publicId);
      if (dispatch === null) throw new NotFoundError();
      this.dependencies.permissions.assertCanComplete(input.context.principal, dispatch);
      const before = dispatchAuditSnapshot(dispatch);
      asDispatchBusinessRule(() => dispatch.complete(odoAfter, at));
      await repositories.dispatches.updateLifecycle(dispatch);
      await repositories.auditEvents.append(
        buildDispatchAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'completed',
          entityPublicId: dispatch.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          before,
          after: dispatchAuditSnapshot(dispatch),
        }),
      );
      const record = await repositories.dispatches.findByPublicId(dispatch.publicId.toString());
      if (record === null) throw new NotFoundError();
      return toDispatchDetailDto(record);
    });
  }
}
