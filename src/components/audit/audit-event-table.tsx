import Link from 'next/link';

import type { AuditEventSummaryDto } from '@/application/audit/dto/audit-event-dtos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function AuditEventTable({ items }: { readonly items: readonly AuditEventSummaryDto[] }) {
  return (
    <>
      <div
        className="hidden max-h-[42rem] overflow-auto rounded-lg border bg-card sm:block"
        role="region"
        aria-label="Audit trail results"
        tabIndex={0}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Request ID</TableHead>
              <TableHead className="text-right">Sequence</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((event) => (
              <TableRow key={event.publicId}>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  <time dateTime={event.occurredAt}>{formatAuditTimestamp(event.occurredAt)}</time>
                </TableCell>
                <TableCell>
                  <ActionLabel action={event.action} />
                </TableCell>
                <TableCell className="max-w-48 break-all font-mono text-xs">
                  {event.actorPublicId ?? 'System'}
                </TableCell>
                <TableCell className="max-w-52 text-xs">
                  <EntityLabel event={event} />
                </TableCell>
                <TableCell className="max-w-52 break-all font-mono text-xs">
                  {event.requestId}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{event.sequence}</TableCell>
                <TableCell>
                  <Button asChild variant="link">
                    <Link href={`/audit/${event.publicId}`}>View event</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 sm:hidden" aria-label="Audit trail results">
        {items.map((event) => (
          <Card key={event.publicId}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1">
                <ActionLabel action={event.action} />
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {event.publicId}
                </p>
              </div>
              <dl className="grid gap-3 text-sm">
                <SummaryItem label="Time">
                  <time className="font-mono text-xs" dateTime={event.occurredAt}>
                    {formatAuditTimestamp(event.occurredAt)}
                  </time>
                </SummaryItem>
                <SummaryItem label="Actor">
                  <span className="break-all font-mono text-xs">
                    {event.actorPublicId ?? 'System'}
                  </span>
                </SummaryItem>
                <SummaryItem label="Entity">
                  <EntityLabel event={event} />
                </SummaryItem>
                <SummaryItem label="Request ID">
                  <span className="break-all font-mono text-xs">{event.requestId}</span>
                </SummaryItem>
                <SummaryItem label="Sequence">
                  <span className="font-mono text-xs">{event.sequence}</span>
                </SummaryItem>
              </dl>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/audit/${event.publicId}`}>View audit event</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function ActionLabel({ action }: { readonly action: string }) {
  const label = action
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase());
  return (
    <Badge className="max-w-full whitespace-normal">
      <span>{label}</span>
      <span className="sr-only">. Canonical action: {action}</span>
    </Badge>
  );
}

function EntityLabel({ event }: { readonly event: AuditEventSummaryDto }) {
  if (event.entity === null) return 'Not applicable';
  return (
    <span className="block break-all font-mono">
      <span className="font-sans font-semibold">{event.entity.type}</span>
      <br />
      {event.entity.publicId}
    </span>
  );
}

function SummaryItem({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
      <dt className="font-semibold">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function formatAuditTimestamp(value: string): string {
  return value.replace('T', ' ').replace('.000Z', 'Z');
}
