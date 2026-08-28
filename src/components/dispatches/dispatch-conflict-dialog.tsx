'use client';

import { CircleAlert, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { DispatchScheduleConflictContextDto } from '@/application/dispatch/dto/dispatch-dtos';
import { DispatchStatusBadge } from '@/components/dispatches/dispatch-status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function DispatchConflictDialog({
  open,
  context,
  pending,
  onOpenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly context: DispatchScheduleConflictContextDto | null;
  readonly pending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (reason: string, fingerprint: string) => void;
}) {
  const [reviewedFingerprint, setReviewedFingerprint] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const summary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => summary.current?.focus());
  }, [context?.fingerprint, open]);

  if (context === null) return null;
  const reviewed = reviewedFingerprint === context.fingerprint;
  const actionable = context.policy === 'WARN_AND_ACK' && context.canOverride;
  const normalizedReason = reason.trim().replaceAll(/\s+/g, ' ');
  const validReason = normalizedReason.length >= 10 && normalizedReason.length <= 500;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="dispatch-conflict-description">
        <DialogHeader>
          <DialogTitle>Schedule conflict review</DialogTitle>
          <DialogDescription id="dispatch-conflict-description">
            The authoritative check found an existing same-day reservation.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={summary}
          tabIndex={-1}
          className="rounded-md border border-warning/40 bg-warning/5 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="flex items-center gap-2 font-semibold">
            <CircleAlert className="size-5 text-warning" aria-hidden="true" />
            {context.conflicts.length} conflict{context.conflicts.length === 1 ? '' : 's'} require
            review
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Effective policy:{' '}
            {context.policy === 'BLOCK' ? 'Block conflicts' : 'Warn and acknowledge'}
          </p>
        </div>
        <ul className="max-h-64 space-y-3 overflow-y-auto" aria-label="Current schedule conflicts">
          {context.conflicts.map((conflict) => (
            <li
              key={`${conflict.dispatchPublicId}-${conflict.conflictType}`}
              className="rounded-md border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{conflict.destination}</p>
                <DispatchStatusBadge status={conflict.status} />
              </div>
              <p className="mt-1 text-muted-foreground">{conflict.purpose}</p>
              <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">Conflict</dt>
                  <dd>{conflictTypeLabel(conflict.conflictType)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Travel date</dt>
                  <dd>{conflict.travelDate}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Driver</dt>
                  <dd>{conflict.driver.name}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Vehicle</dt>
                  <dd>
                    {conflict.vehicle.plateNumber} · {conflict.vehicle.modelBrand}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        {!actionable ? (
          <div className="flex gap-3 rounded-md border p-3 text-sm">
            <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
            <p>
              {context.policy === 'BLOCK'
                ? 'The global policy blocks this assignment. Choose another date, driver, or vehicle.'
                : 'Your account cannot acknowledge schedule conflicts. Ask an authorized dispatch officer to review it.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1 size-4"
                type="checkbox"
                checked={reviewed}
                onChange={(event) =>
                  setReviewedFingerprint(event.target.checked ? context.fingerprint : null)
                }
              />
              <span>I reviewed every conflict above and accept the operational risk.</span>
            </label>
            <div className="space-y-2">
              <label htmlFor="dispatch-conflict-reason" className="text-sm font-semibold">
                Acknowledgment reason
              </label>
              <Textarea
                id="dispatch-conflict-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={10}
                maxLength={500}
                aria-describedby="dispatch-conflict-reason-help"
              />
              <p id="dispatch-conflict-reason-help" className="text-xs text-muted-foreground">
                Provide 10 to 500 characters explaining why the overlapping assignment may proceed.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {actionable ? 'Review assignment' : 'Close'}
          </Button>
          {actionable ? (
            <Button
              type="button"
              disabled={pending || !reviewed || !validReason}
              onClick={() => onConfirm(normalizedReason, context.fingerprint)}
            >
              {pending ? 'Submitting…' : 'Acknowledge and continue'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function conflictTypeLabel(type: 'DRIVER' | 'VEHICLE' | 'DRIVER_AND_VEHICLE'): string {
  if (type === 'DRIVER') return 'Driver';
  if (type === 'VEHICLE') return 'Vehicle';
  return 'Driver and vehicle';
}
