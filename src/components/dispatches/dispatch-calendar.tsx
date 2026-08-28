import { CalendarDays, CircleAlert } from 'lucide-react';
import Link from 'next/link';

import type {
  DispatchResourceOccupancyDto,
  DispatchScheduleEventDto,
  DispatchScheduleView,
} from '@/application/dispatch/dto/dispatch-dtos';
import { DispatchStatusBadge } from '@/components/dispatches/dispatch-status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { civilDateRange, formatCivilDateLabel } from '@/lib/dispatch/calendar-date';

export function DispatchCalendar({
  view,
  from,
  to,
  events,
  occupancy,
  resourceSelected,
}: {
  readonly view: DispatchScheduleView;
  readonly from: string;
  readonly to: string;
  readonly events: readonly DispatchScheduleEventDto[];
  readonly occupancy: readonly DispatchResourceOccupancyDto[];
  readonly resourceSelected: boolean;
}) {
  const dates = civilDateRange(from, to);
  const agenda = (
    <Agenda
      dates={dates}
      events={events}
      occupancy={occupancy}
      resourceSelected={resourceSelected}
    />
  );
  if (view === 'day') return agenda;
  if (view === 'week') {
    return (
      <>
        <div className="hidden grid-cols-7 gap-2 md:grid" aria-label="Weekly dispatch schedule">
          {dates.map((date) => (
            <DateCell
              key={date}
              date={date}
              events={events}
              occupancy={occupancy}
              resourceSelected={resourceSelected}
            />
          ))}
        </div>
        <div className="md:hidden">{agenda}</div>
      </>
    );
  }
  return (
    <>
      <div
        className="hidden grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border sm:grid"
        aria-label="Monthly dispatch schedule"
      >
        {dates.map((date) => (
          <DateCell
            key={date}
            date={date}
            events={events}
            occupancy={occupancy}
            resourceSelected={resourceSelected}
            compact
          />
        ))}
      </div>
      <div className="sm:hidden">{agenda}</div>
    </>
  );
}

function Agenda({
  dates,
  events,
  occupancy,
  resourceSelected,
}: {
  readonly dates: readonly string[];
  readonly events: readonly DispatchScheduleEventDto[];
  readonly occupancy: readonly DispatchResourceOccupancyDto[];
  readonly resourceSelected: boolean;
}) {
  const populated = dates.filter((date) => events.some((event) => event.travelDate === date));
  if (populated.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
          <CalendarDays className="size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-heading text-lg font-semibold">No dispatches in this range</h2>
          <p className="text-sm text-muted-foreground">Adjust the date, view, or filters.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4" aria-label="Dispatch schedule agenda">
      {populated.map((date) => (
        <DateCell
          key={date}
          date={date}
          events={events}
          occupancy={occupancy}
          resourceSelected={resourceSelected}
        />
      ))}
    </div>
  );
}

function DateCell({
  date,
  events,
  occupancy,
  resourceSelected,
  compact = false,
}: {
  readonly date: string;
  readonly events: readonly DispatchScheduleEventDto[];
  readonly occupancy: readonly DispatchResourceOccupancyDto[];
  readonly resourceSelected: boolean;
  readonly compact?: boolean;
}) {
  const items = events.filter((event) => event.travelDate === date);
  const resourceOccupancy = occupancy.filter((item) => item.travelDate === date);
  const conflict = resourceOccupancy.some((item) => item.hasConflict);
  const occupied = resourceOccupancy.some((item) => item.dispatchCount > 0);
  return (
    <section className="min-h-32 space-y-2 bg-card p-3" aria-labelledby={`schedule-${date}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`schedule-${date}`} className="font-heading text-sm font-semibold">
          {formatCivilDateLabel(date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </h2>
        {resourceSelected ? (
          <Badge>{conflict ? 'Conflict' : occupied ? 'Occupied' : 'Available'}</Badge>
        ) : items.length > 1 ? (
          <Badge>{items.length} dispatches</Badge>
        ) : null}
      </div>
      {conflict ? (
        <p className="flex items-center gap-1 text-xs font-semibold text-warning">
          <CircleAlert className="size-3.5" aria-hidden="true" /> Multiple reservations
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No dispatch records</p>
      ) : (
        <ul className="space-y-2">
          {items.map((event) => (
            <li
              key={event.dispatchPublicId}
              className="rounded-md border bg-background p-2 text-xs"
            >
              <Link
                className="font-semibold text-accent hover:underline"
                href={`/dispatches/${event.dispatchPublicId}`}
              >
                {event.destination}
              </Link>
              <p className="mt-1 text-muted-foreground">
                {event.driver.name} · <span className="font-mono">{event.vehicle.plateNumber}</span>
              </p>
              {compact ? null : (
                <div className="mt-2">
                  <DispatchStatusBadge status={event.status} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
