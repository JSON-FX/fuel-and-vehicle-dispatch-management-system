import type { Kysely } from 'kysely';

import type { Clock } from '@/application/auth/ports/clock';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import { CancelDispatch } from '@/application/dispatch/use-cases/cancel-dispatch';
import { CheckDispatchScheduleAvailability } from '@/application/dispatch/use-cases/check-dispatch-schedule-availability';
import { CompleteDispatch } from '@/application/dispatch/use-cases/complete-dispatch';
import { CreateDispatch } from '@/application/dispatch/use-cases/create-dispatch';
import { DispatchVehicle } from '@/application/dispatch/use-cases/dispatch-vehicle';
import { GetDispatch } from '@/application/dispatch/use-cases/get-dispatch';
import { GetDispatchSchedule } from '@/application/dispatch/use-cases/get-dispatch-schedule';
import { GetDispatchScheduleSettings } from '@/application/dispatch/use-cases/get-dispatch-schedule-settings';
import { GetDriverSchedule } from '@/application/dispatch/use-cases/get-driver-schedule';
import { GetDispatchFilterOptions } from '@/application/dispatch/use-cases/get-dispatch-filter-options';
import { GetDispatchPreparationOptions } from '@/application/dispatch/use-cases/get-dispatch-preparation-options';
import { ListDispatches } from '@/application/dispatch/use-cases/list-dispatches';
import { GetVehicleSchedule } from '@/application/dispatch/use-cases/get-vehicle-schedule';
import { UpdateDispatchScheduleSettings } from '@/application/dispatch/use-cases/update-dispatch-schedule-settings';
import { UpdateDraftDispatch } from '@/application/dispatch/use-cases/update-draft-dispatch';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { KyselyDispatchTransaction } from '@/infrastructure/database/dispatch/kysely-dispatch-transaction';
import type { Database } from '@/infrastructure/database/types';
import { NodeSha256DispatchConflictFingerprinter } from '@/infrastructure/dispatch/node-sha256-dispatch-conflict-fingerprinter';

export interface DispatchWebComposition {
  readonly dispatchPermissions: DispatchPermissionPolicy;
  readonly dispatchDependencies: DispatchUseCaseDependencies;
  readonly createDispatch: CreateDispatch;
  readonly getDispatch: GetDispatch;
  readonly getDispatchFilterOptions: GetDispatchFilterOptions;
  readonly listDispatches: ListDispatches;
  readonly getDispatchPreparationOptions: GetDispatchPreparationOptions;
  readonly updateDraftDispatch: UpdateDraftDispatch;
  readonly dispatchVehicle: DispatchVehicle;
  readonly completeDispatch: CompleteDispatch;
  readonly cancelDispatch: CancelDispatch;
  readonly checkDispatchScheduleAvailability: CheckDispatchScheduleAvailability;
  readonly getDispatchSchedule: GetDispatchSchedule;
  readonly getDriverSchedule: GetDriverSchedule;
  readonly getVehicleSchedule: GetVehicleSchedule;
  readonly getDispatchScheduleSettings: GetDispatchScheduleSettings;
  readonly updateDispatchScheduleSettings: UpdateDispatchScheduleSettings;
}

export function createDispatchWebComposition(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions,
  dependencies: { readonly publicIds: PublicIdGenerator; readonly clock: Clock },
): DispatchWebComposition {
  const permissions = new DispatchPermissionPolicy();
  const dispatchDependencies = Object.freeze({
    transaction: new KyselyDispatchTransaction(database, auditOptions),
    permissions,
    conflictFingerprints: new NodeSha256DispatchConflictFingerprinter(),
    ...dependencies,
  });
  const getDispatchSchedule = new GetDispatchSchedule(dispatchDependencies);
  return Object.freeze({
    dispatchPermissions: permissions,
    dispatchDependencies,
    createDispatch: new CreateDispatch(dispatchDependencies),
    getDispatch: new GetDispatch(dispatchDependencies),
    getDispatchFilterOptions: new GetDispatchFilterOptions(dispatchDependencies),
    listDispatches: new ListDispatches(dispatchDependencies),
    getDispatchPreparationOptions: new GetDispatchPreparationOptions(dispatchDependencies),
    updateDraftDispatch: new UpdateDraftDispatch(dispatchDependencies),
    dispatchVehicle: new DispatchVehicle(dispatchDependencies),
    completeDispatch: new CompleteDispatch(dispatchDependencies),
    cancelDispatch: new CancelDispatch(dispatchDependencies),
    checkDispatchScheduleAvailability: new CheckDispatchScheduleAvailability(dispatchDependencies),
    getDispatchSchedule,
    getDriverSchedule: new GetDriverSchedule(getDispatchSchedule),
    getVehicleSchedule: new GetVehicleSchedule(getDispatchSchedule),
    getDispatchScheduleSettings: new GetDispatchScheduleSettings(dispatchDependencies),
    updateDispatchScheduleSettings: new UpdateDispatchScheduleSettings(dispatchDependencies),
  });
}
