import type { ReactNode } from 'react';

export function ResponsiveReferenceResults({
  label,
  table,
  cards,
}: {
  readonly label: string;
  readonly table: ReactNode;
  readonly cards: ReactNode;
}) {
  return (
    <>
      <div
        className="hidden max-h-[42rem] overflow-auto rounded-lg border bg-card sm:block"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {table}
      </div>
      <div className="grid gap-3 sm:hidden" aria-label={label}>
        {cards}
      </div>
    </>
  );
}
