import { History, Link2 } from 'lucide-react';
import Link from 'next/link';

import type { DispatchConflictOverrideHistoryDto } from '@/application/dispatch/dto/dispatch-dtos';
import { Badge } from '@/components/ui/badge';

export function DispatchConflictHistory({
  items,
}: {
  readonly items: readonly DispatchConflictOverrideHistoryDto[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center">
        <History className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">No conflict acknowledgments</p>
        <p className="text-sm text-muted-foreground">
          This dispatch has no recorded schedule override evidence.
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.publicId} className="rounded-md border p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              className="inline-flex items-center gap-2 font-semibold text-accent hover:underline"
              href={`/dispatches/${item.conflictingDispatchPublicId}`}
            >
              <Link2 className="size-4" aria-hidden="true" /> {item.conflictingDispatchLabel}
            </Link>
            <Badge>{item.policy === 'BLOCK' ? 'Blocked policy' : 'Warned and acknowledged'}</Badge>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Conflict type</dt>
              <dd>{typeLabel(item.conflictType)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Acknowledged</dt>
              <dd>
                <time dateTime={item.acknowledgedAt}>
                  {new Intl.DateTimeFormat('en-PH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Manila',
                  }).format(new Date(item.acknowledgedAt))}
                </time>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold">Reason</dt>
              <dd>{item.reason}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold">Actor public ID</dt>
              <dd className="font-mono text-xs">{item.acknowledgedByActorPublicId}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Historical evidence only. Current conflicts are always checked again.
          </p>
        </li>
      ))}
    </ol>
  );
}

function typeLabel(type: 'DRIVER' | 'VEHICLE' | 'DRIVER_AND_VEHICLE'): string {
  if (type === 'DRIVER') return 'Driver';
  if (type === 'VEHICLE') return 'Vehicle';
  return 'Driver and vehicle';
}
