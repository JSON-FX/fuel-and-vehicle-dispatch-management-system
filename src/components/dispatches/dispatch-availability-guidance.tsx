'use client';

import { CalendarCheck, CircleAlert, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DispatchScheduleConflictContextDto } from '@/application/dispatch/dto/dispatch-dtos';
import { readDispatchApiResponse } from '@/lib/dispatch/dispatch-form-response';

type AvailabilityState =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'available' }
  | { readonly kind: 'conflict'; readonly result: DispatchScheduleConflictContextDto }
  | { readonly kind: 'failure' };

interface AvailabilityResult {
  readonly key: string;
  readonly state: AvailabilityState;
}

export function DispatchAvailabilityGuidance({
  travelDate,
  driverPublicId,
  vehiclePublicId,
  excludedDispatchPublicId,
}: {
  readonly travelDate: string;
  readonly driverPublicId: string;
  readonly vehiclePublicId: string;
  readonly excludedDispatchPublicId?: string | undefined;
}) {
  const complete = travelDate !== '' && driverPublicId !== '' && vehiclePublicId !== '';
  const requestKey = `${travelDate}:${driverPublicId}:${vehiclePublicId}:${excludedDispatchPublicId ?? ''}`;
  const [result, setResult] = useState<AvailabilityResult | null>(null);

  useEffect(() => {
    if (!complete) return;
    const controller = new AbortController();
    const search = new URLSearchParams({ travelDate, driverPublicId, vehiclePublicId });
    if (excludedDispatchPublicId !== undefined) {
      search.set('excludedDispatchPublicId', excludedDispatchPublicId);
    }
    void fetch(`/api/dispatches/conflicts?${search.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => readDispatchApiResponse<DispatchScheduleConflictContextDto>(response))
      .then((responseResult) =>
        setResult({
          key: requestKey,
          state:
            responseResult.conflicts.length === 0
              ? { kind: 'available' }
              : { kind: 'conflict', result: responseResult },
        }),
      )
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResult({ key: requestKey, state: { kind: 'failure' } });
        }
      });
    return () => controller.abort();
  }, [complete, driverPublicId, excludedDispatchPublicId, requestKey, travelDate, vehiclePublicId]);

  const state: AvailabilityState = !complete
    ? { kind: 'waiting' }
    : result?.key === requestKey
      ? result.state
      : { kind: 'loading' };
  const content = availabilityContent(state);
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-11 items-start gap-3 rounded-md border bg-muted/40 p-3 text-sm"
    >
      {content.icon}
      <div>
        <p className="font-semibold">{content.title}</p>
        <p className="text-muted-foreground">{content.body}</p>
      </div>
    </div>
  );
}

function availabilityContent(state: AvailabilityState) {
  if (state.kind === 'loading') {
    return {
      icon: (
        <LoaderCircle
          className="size-5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ),
      title: 'Checking availability',
      body: 'Reviewing the selected driver and vehicle schedule.',
    };
  }
  if (state.kind === 'available') {
    return {
      icon: <CalendarCheck className="size-5 text-success" aria-hidden="true" />,
      title: 'Driver and vehicle available',
      body: 'No reserving dispatch uses either resource on this travel date.',
    };
  }
  if (state.kind === 'conflict') {
    return {
      icon: <CircleAlert className="size-5 text-warning" aria-hidden="true" />,
      title: `${state.result.conflicts.length} schedule conflict${state.result.conflicts.length === 1 ? '' : 's'} found`,
      body:
        state.result.policy === 'BLOCK'
          ? 'The current policy blocks this assignment.'
          : 'You may still submit. The final check may require an authorized acknowledgment.',
    };
  }
  if (state.kind === 'failure') {
    return {
      icon: <CircleAlert className="size-5 text-warning" aria-hidden="true" />,
      title: 'Availability check unavailable',
      body: 'You may still save. The server will perform the authoritative schedule check.',
    };
  }
  return {
    icon: <CalendarCheck className="size-5 text-muted-foreground" aria-hidden="true" />,
    title: 'Availability not checked',
    body: 'Select a travel date, driver, and vehicle to check their schedule.',
  };
}
