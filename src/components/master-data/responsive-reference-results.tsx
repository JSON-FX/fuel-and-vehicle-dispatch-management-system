import type { ReactNode } from 'react';

export function ResponsiveReferenceResults({
  label,
  table,
  cards,
  desktopBreakpoint = 'sm',
}: {
  readonly label: string;
  readonly table: ReactNode;
  readonly cards: ReactNode;
  readonly desktopBreakpoint?: 'sm' | 'lg';
}) {
  const tableVisibility = desktopBreakpoint === 'lg' ? 'lg:block' : 'sm:block';
  const cardVisibility = desktopBreakpoint === 'lg' ? 'lg:hidden' : 'sm:hidden';

  return (
    <>
      <div
        className={`hidden max-h-[42rem] overflow-auto rounded-lg border bg-card ${tableVisibility}`}
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {table}
      </div>
      <div className={`grid gap-3 ${cardVisibility}`} aria-label={label}>
        {cards}
      </div>
    </>
  );
}
