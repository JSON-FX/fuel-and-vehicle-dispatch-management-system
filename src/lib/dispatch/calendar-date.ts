import type { DispatchScheduleView } from '@/application/dispatch/dto/dispatch-dtos';

const civilDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function manilaCivilDate(at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function addCivilDays(value: string, days: number): string {
  const date = civilDateToUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToCivilDate(date);
}

export function addCivilMonths(value: string, months: number): string {
  const date = civilDateToUtc(value);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return utcToCivilDate(date);
}

export function dispatchScheduleRange(
  view: DispatchScheduleView,
  anchor: string,
): { readonly from: string; readonly to: string } {
  const date = civilDateToUtc(anchor);
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') {
    const offset = (date.getUTCDay() + 6) % 7;
    const from = addCivilDays(anchor, -offset);
    return { from, to: addCivilDays(from, 6) };
  }
  const first = `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}-01`;
  const firstDate = civilDateToUtc(first);
  const offset = (firstDate.getUTCDay() + 6) % 7;
  const from = addCivilDays(first, -offset);
  return { from, to: addCivilDays(from, 41) };
}

export function civilDateRange(from: string, to: string): readonly string[] {
  const values: string[] = [];
  for (let current = from; current <= to; current = addCivilDays(current, 1)) {
    values.push(current);
  }
  return values;
}

export function formatCivilDateLabel(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(civilDateToUtc(value));
}

function civilDateToUtc(value: string): Date {
  const match = civilDatePattern.exec(value);
  if (match === null) throw new Error('Invalid civil date.');
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Invalid civil date.');
  }
  return date;
}

function utcToCivilDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
