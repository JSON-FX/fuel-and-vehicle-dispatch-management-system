import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { ValidationError } from '@/application/shared/errors/application-error';
import { DispatchCalendar } from '@/components/dispatches/dispatch-calendar';
import { DispatchScheduleFilterForm } from '@/components/dispatches/dispatch-schedule-filter-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerAuthentication } from '@/lib/auth/server-authentication';
import {
  addCivilDays,
  addCivilMonths,
  formatCivilDateLabel,
  manilaCivilDate,
} from '@/lib/dispatch/calendar-date';
import {
  parseSchedulePageQuery,
  schedulePageHref,
  type SchedulePageSearchParams,
  type SchedulePageValues,
} from '@/lib/dispatch/schedule-page-query';
import { authorizeDispatchPageAccess } from '@/lib/dispatch/server-dispatch-access';

export const dynamic = 'force-dynamic';

export default async function DispatchSchedulePage({
  searchParams,
}: {
  readonly searchParams: Promise<SchedulePageSearchParams>;
}) {
  const { composition, session } = await getServerAuthentication();
  const access = await authorizeDispatchPageAccess(
    composition,
    session.principal,
    '/dispatches/schedule',
  );
  if (access === null)
    return (
      <Message
        title="Schedule access denied"
        body="Your account cannot view vehicle dispatch schedules."
      />
    );

  const today = manilaCivilDate();
  let parsed: ReturnType<typeof parseSchedulePageQuery>;
  try {
    parsed = parseSchedulePageQuery(await searchParams, today);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return (
      <Message title="Invalid schedule filters" body="Clear the schedule filters and try again." />
    );
  }
  const [schedule, options] = await Promise.all([
    composition.getDispatchSchedule.execute({ context: access, query: parsed.query }),
    composition.getDispatchFilterOptions.execute({ context: access }),
  ]);
  const previousDate = stepDate(parsed.values, -1);
  const nextDate = stepDate(parsed.values, 1);
  const resourceSelected =
    parsed.values.driverPublicId !== '' || parsed.values.vehiclePublicId !== '';

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Button asChild variant="link">
          <Link href="/dispatches">
            <ArrowLeft aria-hidden="true" /> Back to vehicle dispatches
          </Link>
        </Button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Dispatch schedule
            </h1>
            <p className="mt-2 text-muted-foreground">
              Review same-day driver and vehicle reservations before preparing an assignment.
            </p>
          </div>
          <Button asChild>
            <Link href="/dispatches/new">New dispatch</Link>
          </Button>
        </div>
      </header>

      <DispatchScheduleFilterForm values={parsed.values} options={options} />

      <section className="space-y-4" aria-labelledby="schedule-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="schedule-heading" className="font-heading text-xl font-semibold">
              {formatCivilDateLabel(schedule.from)}
              {schedule.from === schedule.to ? '' : ` – ${formatCivilDateLabel(schedule.to)}`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {resourceSelected
                ? 'Availability reflects all reserving statuses, even when the display status is filtered.'
                : `${schedule.events.length} dispatch record${schedule.events.length === 1 ? '' : 's'} shown. Select a driver or vehicle for availability.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Schedule navigation">
            <Button asChild variant="outline" size="icon">
              <Link
                aria-label="Previous period"
                href={schedulePageHref({ ...parsed.values, date: previousDate })}
              >
                <ChevronLeft aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={schedulePageHref({ ...parsed.values, date: today })}>Today</Link>
            </Button>
            <Button asChild variant="outline" size="icon">
              <Link
                aria-label="Next period"
                href={schedulePageHref({ ...parsed.values, date: nextDate })}
              >
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
            {(['day', 'week', 'month'] as const).map((view) => (
              <Button
                key={view}
                asChild
                variant={parsed.values.view === view ? 'default' : 'outline'}
              >
                <Link href={schedulePageHref({ ...parsed.values, view })}>
                  {view[0]?.toUpperCase()}
                  {view.slice(1)}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        {schedule.truncated ? (
          <div
            role="status"
            className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm"
          >
            More than 200 dispatches match this view. Narrow the filters. Availability remains
            complete.
          </div>
        ) : null}
        <DispatchCalendar
          view={parsed.values.view}
          from={schedule.from}
          to={schedule.to}
          events={schedule.events}
          occupancy={schedule.occupancy}
          resourceSelected={resourceSelected}
        />
      </section>
    </div>
  );
}

function stepDate(values: SchedulePageValues, direction: -1 | 1): string {
  if (values.view === 'day') return addCivilDays(values.date, direction);
  if (values.view === 'week') return addCivilDays(values.date, direction * 7);
  return addCivilMonths(values.date, direction);
}

function Message({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
        <CalendarDays className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
        <Button asChild variant="outline">
          <Link href="/dispatches/schedule">Clear schedule filters</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
