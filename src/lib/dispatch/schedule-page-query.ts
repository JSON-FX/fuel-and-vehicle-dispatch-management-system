import type {
  DispatchScheduleQuery,
  DispatchScheduleView,
} from '@/application/dispatch/dto/dispatch-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { dispatchScheduleRange } from '@/lib/dispatch/calendar-date';
import { dispatchPublicIdSchema } from '@/lib/dispatch/route-schemas';

export interface SchedulePageSearchParams {
  readonly view?: string | readonly string[];
  readonly date?: string | readonly string[];
  readonly requestingOfficePublicId?: string | readonly string[];
  readonly driverPublicId?: string | readonly string[];
  readonly vehiclePublicId?: string | readonly string[];
  readonly status?: string | readonly string[];
  readonly [key: string]: string | readonly string[] | undefined;
}

export interface SchedulePageValues {
  readonly view: DispatchScheduleView;
  readonly date: string;
  readonly requestingOfficePublicId: string;
  readonly driverPublicId: string;
  readonly vehiclePublicId: string;
  readonly status: string;
}

const allowedKeys = new Set([
  'view',
  'date',
  'requestingOfficePublicId',
  'driverPublicId',
  'vehiclePublicId',
  'status',
]);

export function parseSchedulePageQuery(
  input: SchedulePageSearchParams,
  today: string,
): { readonly values: SchedulePageValues; readonly query: DispatchScheduleQuery } {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) invalid(key, 'Unknown schedule filter.');
  }
  const view = optionalSingle(input.view, 'view') || 'week';
  if (view !== 'day' && view !== 'week' && view !== 'month') invalid('view', 'Invalid view.');
  const date = optionalSingle(input.date, 'date') || today;
  let range: { readonly from: string; readonly to: string };
  try {
    range = dispatchScheduleRange(view, date);
  } catch {
    invalid('date', 'Invalid schedule date.');
  }
  const requestingOfficePublicId = optionalPublicId(
    input.requestingOfficePublicId,
    'requestingOfficePublicId',
  );
  const driverPublicId = optionalPublicId(input.driverPublicId, 'driverPublicId');
  const vehiclePublicId = optionalPublicId(input.vehiclePublicId, 'vehiclePublicId');
  const status = optionalSingle(input.status, 'status');
  if (status !== '' && !['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'].includes(status)) {
    invalid('status', 'Invalid dispatch status.');
  }
  const values: SchedulePageValues = {
    view,
    date,
    requestingOfficePublicId,
    driverPublicId,
    vehiclePublicId,
    status,
  };
  return {
    values,
    query: {
      ...range,
      requestingOfficePublicId: requestingOfficePublicId || null,
      driverPublicId: driverPublicId || null,
      vehiclePublicId: vehiclePublicId || null,
      status: status === '' ? null : (status as DispatchScheduleQuery['status']),
      limit: 200,
    },
  };
}

export function schedulePageHref(values: SchedulePageValues): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value.length > 0) search.set(key, value);
  }
  return `/dispatches/schedule?${search.toString()}`;
}

function optionalSingle(value: string | readonly string[] | undefined, field: string): string {
  if (typeof value !== 'string') {
    if (value !== undefined) invalid(field, 'Provide this filter once.');
    return '';
  }
  return value.trim();
}

function optionalPublicId(value: string | readonly string[] | undefined, field: string): string {
  const parsed = optionalSingle(value, field);
  if (parsed !== '' && !dispatchPublicIdSchema.safeParse(parsed).success) {
    invalid(field, 'Provide a valid public identifier.');
  }
  return parsed;
}

function invalid(field: string, reason: string): never {
  throw new ValidationError([{ field, reason }]);
}
